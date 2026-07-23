from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser
from app.models.user import User
from app.services import auth_service, mfa as mfa_service, resend_email
from app.services.admin_access import is_admin_email

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterBody(BaseModel):
    name: str
    email: str
    password: str


class SignInBody(BaseModel):
    email: str
    password: str


class VerifyEmailBody(BaseModel):
    email: str
    otp: str


class RequestResetBody(BaseModel):
    email: str


class ResetPasswordBody(BaseModel):
    email: str
    otp: str
    password: str


async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def _admin_mfa_gate(db: AsyncSession, user: User) -> dict | None:
    """If allowlisted admin needs MFA, return gate payload; else None for full session."""
    if not is_admin_email(user.email):
        return None
    if mfa_service.skip_mfa_in_dev():
        return None
    methods = await mfa_service.get_enabled_mfa_methods(db, user.id)
    if methods:
        return {
            "requiresMfa": True,
            "tempToken": mfa_service.make_temp_token(user.id, mfa_pending=True),
            "methods": methods,
            "user": {"email": user.email, "name": user.name, "isAdmin": True},
        }
    return {
        "requiresMfaSetup": True,
        "tempToken": mfa_service.make_temp_token(user.id, mfa_setup=True),
        "user": {"email": user.email, "name": user.name, "isAdmin": True},
    }


def _full_session(user: User) -> dict:
    return {
        "token": auth_service.create_jwt(user.id, user.email),
        "user": {
            "email": user.email,
            "name": user.name,
            "isAdmin": is_admin_email(user.email),
        },
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterBody, db: AsyncSession = Depends(get_db)):
    email = body.email.lower()
    existing = await _get_user_by_email(db, email)
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")
    if len(body.password.encode()) > 72:
        raise HTTPException(status_code=422, detail="Password must be 72 characters or fewer.")

    user = User(
        email=email,
        name=body.name.strip(),
        hashed_password=auth_service.hash_password(body.password),
        is_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    gate = await _admin_mfa_gate(db, user)
    if gate:
        return gate
    return _full_session(user)


@router.post("/verify-email")
async def verify_email(body: VerifyEmailBody, db: AsyncSession = Depends(get_db)):
    email = body.email.lower()
    user = await _get_user_by_email(db, email)
    if not user or not user.otp_code:
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    now = datetime.now(tz=timezone.utc)
    otp_exp = user.otp_expires_at
    if otp_exp and otp_exp.tzinfo is None:
        otp_exp = otp_exp.replace(tzinfo=timezone.utc)

    if user.otp_code != body.otp.strip() or (otp_exp and otp_exp < now):
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    await db.commit()

    gate = await _admin_mfa_gate(db, user)
    if gate:
        return gate
    return _full_session(user)


@router.post("/sign-in")
async def sign_in(body: SignInBody, db: AsyncSession = Depends(get_db)):
    email = body.email.lower()
    user = await _get_user_by_email(db, email)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.hashed_password:
        raise HTTPException(status_code=401, detail="This account has no password set. Use 'Forgot password' to create one.")

    if len(body.password.encode()) > 72:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not auth_service.verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    gate = await _admin_mfa_gate(db, user)
    if gate:
        return gate
    return _full_session(user)


@router.post("/request-password-reset")
async def request_password_reset(body: RequestResetBody, db: AsyncSession = Depends(get_db)):
    email = body.email.lower()
    user = await _get_user_by_email(db, email)

    if user:
        otp = auth_service.generate_otp()
        user.otp_code = otp
        user.otp_expires_at = auth_service.otp_expiry(minutes=10)
        await db.commit()
        try:
            await resend_email.send_password_reset_email(email, otp)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error("Resend failed: %s — OTP for %s is %s", exc, email, otp)

    return {"message": "If an account with that email exists, a reset code has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordBody, db: AsyncSession = Depends(get_db)):
    email = body.email.lower()
    user = await _get_user_by_email(db, email)
    if not user or not user.otp_code:
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    now = datetime.now(tz=timezone.utc)
    otp_exp = user.otp_expires_at
    if otp_exp and otp_exp.tzinfo is None:
        otp_exp = otp_exp.replace(tzinfo=timezone.utc)

    if user.otp_code != body.otp.strip() or (otp_exp and otp_exp < now):
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")
    if len(body.password.encode()) > 72:
        raise HTTPException(status_code=422, detail="Password must be 72 characters or fewer.")

    user.hashed_password = auth_service.hash_password(body.password)
    user.otp_code = None
    user.otp_expires_at = None
    await db.commit()

    gate = await _admin_mfa_gate(db, user)
    if gate:
        return gate
    return _full_session(user)


@router.get("/me")
async def get_me(current_user: CurrentUser):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "credit_balance": current_user.credit_balance,
        "isAdmin": is_admin_email(current_user.email),
    }
