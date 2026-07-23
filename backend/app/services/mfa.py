"""Admin MFA helpers (email OTP + TOTP). Mirror AmroImageGen / Academy."""
from __future__ import annotations

import hashlib
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import pyotp
from jose import jwt
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.mfa import OtpCode, UserMfa
from app.models.user import User
from app.services.admin_access import is_admin_email
from app.services.auth_service import create_jwt, generate_otp

MFA_ISSUER = "AmroGen"


def hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def sanitize_totp_label(email: str) -> str:
    label = str(email).replace("@", "-at-")
    return re.sub(r"[^a-zA-Z0-9.-]", "", label)


def skip_mfa_in_dev() -> bool:
    settings = get_settings()
    return (
        settings.environment == "development"
        and settings.force_mfa_for_admin is not True
    )


def normalize_six_digit_code(code: str | None) -> str:
    digits = re.sub(r"\D", "", str(code or "").strip())
    return digits[:6]


def create_totp_setup(email: str) -> dict[str, str]:
    secret = pyotp.random_base32()
    label = sanitize_totp_label(email)
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=f"AmroGen:{label}", issuer_name=MFA_ISSUER)
    return {"secret": secret, "uri": uri}


def verify_totp_code(secret: str, code: str) -> bool:
    if not secret:
        return False
    totp = pyotp.TOTP(secret)
    return bool(totp.verify(code, valid_window=1))


def make_temp_token(
    user_id: uuid.UUID,
    *,
    mfa_pending: bool = False,
    mfa_setup: bool = False,
) -> str:
    settings = get_settings()
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "userId": str(user_id),
    }
    if mfa_pending:
        payload["mfaPending"] = True
        expires = datetime.now(timezone.utc) + timedelta(minutes=5)
    else:
        payload["mfaSetup"] = True
        expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload["exp"] = expires
    payload["iat"] = datetime.now(timezone.utc)
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_temp_token(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except Exception:
        return None


def user_id_from_payload(payload: dict[str, Any]) -> uuid.UUID | None:
    raw = payload.get("userId") or payload.get("sub") or payload.get("user_id")
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except ValueError:
        return None


def session_payload(user: User) -> dict[str, Any]:
    return {
        "token": create_jwt(user.id, user.email),
        "user": {
            "email": user.email,
            "name": user.name,
            "isAdmin": is_admin_email(user.email),
        },
    }


async def get_enabled_mfa_methods(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    result = await db.execute(
        select(UserMfa.method).where(UserMfa.user_id == user_id, UserMfa.enabled.is_(True))
    )
    methods = [row[0] or "totp" for row in result.all()]
    return [m for m in methods if m and m != "sms"]


async def consume_email_otp(db: AsyncSession, user_id: uuid.UUID, code: str) -> bool:
    code_hash = hash_code(code)
    now = datetime.now(timezone.utc)
    result = await db.execute(
        delete(OtpCode)
        .where(
            OtpCode.user_id == user_id,
            OtpCode.method == "email",
            OtpCode.code_hash == code_hash,
            OtpCode.expires_at > now,
        )
        .returning(OtpCode.id)
    )
    row = result.first()
    if row:
        await db.commit()
        return True
    await db.rollback()
    return False


async def store_email_otp(db: AsyncSession, user_id: uuid.UUID) -> str:
    code = generate_otp()
    code_hash = hash_code(code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.add(
        OtpCode(
            user_id=user_id,
            code_hash=code_hash,
            method="email",
            expires_at=expires_at,
        )
    )
    await db.commit()
    return code


async def upsert_mfa_method(
    db: AsyncSession,
    user_id: uuid.UUID,
    method: str,
    *,
    secret: str | None = None,
    enabled: bool = True,
) -> None:
    result = await db.execute(
        select(UserMfa).where(UserMfa.user_id == user_id, UserMfa.method == method)
    )
    row = result.scalar_one_or_none()
    if row:
        row.enabled = enabled
        if secret is not None:
            row.secret_encrypted = secret
        row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(
            UserMfa(
                user_id=user_id,
                method=method,
                secret_encrypted=secret or "",
                enabled=enabled,
            )
        )
    await db.commit()


async def enable_pending_methods(db: AsyncSession, user_id: uuid.UUID) -> None:
    result = await db.execute(
        select(UserMfa).where(UserMfa.user_id == user_id, UserMfa.enabled.is_(False))
    )
    rows = result.scalars().all()
    for row in rows:
        row.enabled = True
        row.updated_at = datetime.now(timezone.utc)
    await db.commit()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
