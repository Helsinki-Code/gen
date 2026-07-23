"""Admin MFA HTTP routes (email OTP + TOTP)."""
from __future__ import annotations

import logging
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser
from app.models.mfa import UserMfa
from app.services import mfa as mfa_service
from app.services import resend_email
from app.services.admin_access import is_admin_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["mfa"])


class TempTokenBody(BaseModel):
    tempToken: str


class VerifyMfaBody(BaseModel):
    tempToken: str
    code: str


class SetupMfaBody(BaseModel):
    tempToken: str
    method: str = "totp"


class SetupMfaVerifyBody(BaseModel):
    tempToken: str
    code: str


class VerifyTotpBody(BaseModel):
    code: str
    tempToken: Optional[str] = None


class RemoveMfaBody(BaseModel):
    method: str


async def _user_from_temp(
    db: AsyncSession,
    temp_token: str,
    *,
    require_pending: bool = False,
    require_setup: bool = False,
) -> uuid.UUID:
    decoded = mfa_service.decode_temp_token(temp_token)
    if not decoded:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    if require_pending and not decoded.get("mfaPending"):
        raise HTTPException(status_code=401, detail="Invalid token")
    if require_setup and not decoded.get("mfaSetup"):
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = mfa_service.user_id_from_payload(decoded)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await mfa_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user_id


async def _resolve_user_id(
    db: AsyncSession,
    *,
    authorization: Optional[str],
    temp_token: Optional[str],
) -> tuple[uuid.UUID, bool]:
    """Return (user_id, from_temp)."""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        decoded = mfa_service.decode_temp_token(token)
        if decoded and not decoded.get("mfaPending") and not decoded.get("mfaSetup"):
            user_id = mfa_service.user_id_from_payload(decoded)
            if user_id:
                return user_id, False
        if decoded and (decoded.get("mfaPending") or decoded.get("mfaSetup")):
            user_id = mfa_service.user_id_from_payload(decoded)
            if user_id:
                return user_id, True

    if temp_token:
        decoded = mfa_service.decode_temp_token(temp_token)
        if not decoded:
            raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
        user_id = mfa_service.user_id_from_payload(decoded)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id, True

    raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/verify-mfa")
async def verify_mfa(body: VerifyMfaBody, db: AsyncSession = Depends(get_db)):
    code = mfa_service.normalize_six_digit_code(body.code)
    if len(code) != 6:
        raise HTTPException(status_code=400, detail="Please enter the 6-digit code.")

    user_id = await _user_from_temp(db, body.tempToken, require_pending=True)
    result = await db.execute(
        select(UserMfa).where(UserMfa.user_id == user_id, UserMfa.enabled.is_(True))
    )
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(status_code=401, detail="MFA not configured")

    valid = False
    for row in rows:
        if row.method == "totp" and row.secret_encrypted:
            if mfa_service.verify_totp_code(row.secret_encrypted, code):
                valid = True
                break
        elif row.method == "email":
            if await mfa_service.consume_email_otp(db, user_id, code):
                valid = True
                break

    if not valid:
        raise HTTPException(status_code=401, detail="The verification code is incorrect or expired.")

    user = await mfa_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return mfa_service.session_payload(user)


@router.post("/send-otp-email")
async def send_otp_email(body: TempTokenBody, db: AsyncSession = Depends(get_db)):
    user_id = await _user_from_temp(db, body.tempToken, require_pending=True)
    user = await mfa_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    code = await mfa_service.store_email_otp(db, user_id)
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#fff;border-radius:8px;padding:40px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color:#1f2937;font-size:24px;">Your sign-in code</h1>
    <p>Your AmroGen verification code is:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:0.2em;text-align:center;margin:24px 0;">{code}</p>
    <p style="font-size:14px;color:#6b7280;">This code expires in 10 minutes. If you did not try to sign in, you can ignore this email.</p>
  </div>
</body></html>"""
    try:
        await resend_email.send_system_email(user.email, "Your AmroGen sign-in code", html)
    except Exception as exc:
        logger.error("MFA OTP email failed: %s", exc)
        msg = str(exc).upper()
        if "RESEND" in msg:
            raise HTTPException(
                status_code=503,
                detail="Email OTP is not available. Please use another method or contact support.",
            ) from exc
        raise HTTPException(status_code=500, detail="Failed to send code") from exc

    return {"message": "Verification code sent to your email."}


@router.post("/setup-mfa")
async def setup_mfa(body: SetupMfaBody, db: AsyncSession = Depends(get_db)):
    user_id = await _user_from_temp(db, body.tempToken, require_setup=True)
    user = await mfa_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    method = (body.method or "totp").lower().strip()

    if method == "both":
        await mfa_service.upsert_mfa_method(db, user_id, "email", secret="", enabled=True)
        setup = mfa_service.create_totp_setup(user.email)
        await mfa_service.upsert_mfa_method(
            db, user_id, "totp", secret=setup["secret"], enabled=False
        )
        return {
            "uri": setup["uri"],
            "secret": setup["secret"],
            "needsVerify": True,
            "message": (
                "Email is set. Scan the QR code with your authenticator app, "
                "then enter the 6-digit code to complete."
            ),
        }

    if method == "email":
        await mfa_service.upsert_mfa_method(db, user_id, "email", secret="", enabled=True)
        return mfa_service.session_payload(user)

    if method == "totp":
        setup = mfa_service.create_totp_setup(user.email)
        await mfa_service.upsert_mfa_method(
            db, user_id, "totp", secret=setup["secret"], enabled=False
        )
        return {
            "uri": setup["uri"],
            "secret": setup["secret"],
            "needsVerify": True,
            "message": "Scan the QR code with your authenticator app, then enter the 6-digit code.",
        }

    raise HTTPException(status_code=400, detail="Invalid method. Use email, totp, or both.")


@router.post("/setup-mfa-verify")
async def setup_mfa_verify(body: SetupMfaVerifyBody, db: AsyncSession = Depends(get_db)):
    code = mfa_service.normalize_six_digit_code(body.code)
    if len(code) != 6:
        raise HTTPException(status_code=400, detail="Please enter the 6-digit code.")

    user_id = await _user_from_temp(db, body.tempToken, require_setup=True)
    result = await db.execute(
        select(UserMfa).where(UserMfa.user_id == user_id, UserMfa.enabled.is_(False))
    )
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(
            status_code=401,
            detail="MFA setup not found. Please start the MFA setup process again.",
        )

    valid = False
    for row in rows:
        if row.method == "totp" and row.secret_encrypted:
            if mfa_service.verify_totp_code(row.secret_encrypted, code):
                valid = True
                break
        elif row.method == "email":
            if await mfa_service.consume_email_otp(db, user_id, code):
                valid = True
                break

    if not valid:
        raise HTTPException(status_code=401, detail="The verification code is incorrect or expired.")

    await mfa_service.enable_pending_methods(db, user_id)
    user = await mfa_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return mfa_service.session_payload(user)


@router.get("/security/mfa-methods")
async def security_mfa_methods(
    db: AsyncSession = Depends(get_db),
    authorization: Annotated[Optional[str], Header()] = None,
    tempToken: Optional[str] = None,
):
    try:
        user_id, _ = await _resolve_user_id(db, authorization=authorization, temp_token=tempToken)
        methods = await mfa_service.get_enabled_mfa_methods(db, user_id)
        return {"methods": methods}
    except HTTPException:
        raise
    except Exception:
        return {"methods": []}


@router.post("/security/add-totp")
async def security_add_totp(
    db: AsyncSession = Depends(get_db),
    authorization: Annotated[Optional[str], Header()] = None,
    body: Optional[TempTokenBody] = None,
):
    temp_token = body.tempToken if body else None
    user_id, _ = await _resolve_user_id(db, authorization=authorization, temp_token=temp_token)
    user = await mfa_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    setup = mfa_service.create_totp_setup(user.email)
    await mfa_service.upsert_mfa_method(db, user_id, "totp", secret=setup["secret"], enabled=False)
    return {
        "uri": setup["uri"],
        "secret": setup["secret"],
        "needsVerify": True,
        "message": "Scan the QR code with your authenticator app, then enter the 6-digit code.",
    }


@router.post("/security/verify-totp")
async def security_verify_totp(body: VerifyTotpBody, db: AsyncSession = Depends(get_db), authorization: Annotated[Optional[str], Header()] = None):
    code = mfa_service.normalize_six_digit_code(body.code)
    if len(code) != 6:
        raise HTTPException(status_code=400, detail="Please enter the 6-digit code.")

    user_id, from_temp = await _resolve_user_id(
        db, authorization=authorization, temp_token=body.tempToken
    )

    result = await db.execute(
        select(UserMfa).where(UserMfa.user_id == user_id, UserMfa.enabled.is_(False))
    )
    rows = result.scalars().all()
    valid = False
    for row in rows:
        if row.method == "totp" and row.secret_encrypted:
            if mfa_service.verify_totp_code(row.secret_encrypted, code):
                valid = True
                break

    if not valid:
        raise HTTPException(status_code=401, detail="The verification code is incorrect or expired.")

    result = await db.execute(
        select(UserMfa).where(
            UserMfa.user_id == user_id, UserMfa.method == "totp", UserMfa.enabled.is_(False)
        )
    )
    pending = result.scalar_one_or_none()
    if pending:
        pending.enabled = True
        await db.commit()

    if from_temp:
        user = await mfa_service.get_user_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return mfa_service.session_payload(user)

    return {"success": True}


@router.post("/security/add-email")
async def security_add_email(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await mfa_service.upsert_mfa_method(db, current_user.id, "email", secret="", enabled=True)
    return {"success": True}


@router.post("/security/remove-mfa")
async def security_remove_mfa(
    body: RemoveMfaBody,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    method = body.method
    if method not in ("email", "totp"):
        raise HTTPException(status_code=400, detail="Invalid method")

    count_result = await db.execute(
        select(func.count())
        .select_from(UserMfa)
        .where(UserMfa.user_id == current_user.id, UserMfa.enabled.is_(True))
    )
    count = int(count_result.scalar_one() or 0)

    if count <= 1 and is_admin_email(current_user.email):
        raise HTTPException(
            status_code=400,
            detail="Admin accounts must have at least one MFA method.",
        )

    await db.execute(
        delete(UserMfa).where(UserMfa.user_id == current_user.id, UserMfa.method == method)
    )
    await db.commit()
    return {"success": True}
