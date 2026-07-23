from __future__ import annotations

import uuid
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.resend_connection import ResendConnection
from app.services.encryption import decrypt_text, encrypt_text

_settings = get_settings()


async def _send_transactional(to: str, subject: str, html: str) -> None:
    """Send via the system Resend API key (not a user connection)."""
    if not _settings.resend_api_key:
        raise ValueError("RESEND_API_KEY not configured — cannot send transactional email")
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {_settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json={"from": _settings.resend_from_email, "to": [to], "subject": subject, "html": html},
        )
    response.raise_for_status()


async def send_system_email(to: str, subject: str, html: str) -> None:
    """Public wrapper for platform transactional email (digests, alerts, OTP)."""
    await _send_transactional(to, subject, html)


async def send_password_reset_email(to_email: str, otp: str) -> None:
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0f1923;color:#e2e8f0;border-radius:12px">
      <div style="text-align:center;margin-bottom:32px">
        <span style="font-size:28px;font-weight:900;background:linear-gradient(135deg,#2ab5a0,#1ab7ea);-webkit-background-clip:text;-webkit-text-fill-color:transparent">AmroGen</span>
      </div>
      <h2 style="font-size:22px;font-weight:700;margin:0 0 8px">Reset your password</h2>
      <p style="color:#94a3b8;margin:0 0 28px;font-size:14px;line-height:1.6">Use this code to reset your AmroGen password. It expires in <strong style="color:#e2e8f0">10 minutes</strong>.</p>
      <div style="background:#1a2634;border:1px solid rgba(42,181,160,0.25);border-radius:10px;padding:24px;text-align:center;margin-bottom:28px">
        <span style="font-size:36px;font-weight:900;letter-spacing:10px;color:#2ab5a0">{otp}</span>
      </div>
      <p style="color:#64748b;font-size:12px;text-align:center">If you didn't request this, ignore this email — your password won't change.</p>
    </div>
    """
    await _send_transactional(to_email, "Your AmroGen password reset code", html)


async def send_verification_email(to_email: str, name: str, otp: str) -> None:
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0f1923;color:#e2e8f0;border-radius:12px">
      <div style="text-align:center;margin-bottom:32px">
        <span style="font-size:28px;font-weight:900;background:linear-gradient(135deg,#2ab5a0,#1ab7ea);-webkit-background-clip:text;-webkit-text-fill-color:transparent">AmroGen</span>
      </div>
      <h2 style="font-size:22px;font-weight:700;margin:0 0 8px">Welcome, {name}!</h2>
      <p style="color:#94a3b8;margin:0 0 28px;font-size:14px;line-height:1.6">Verify your email address to activate your account. This code expires in <strong style="color:#e2e8f0">10 minutes</strong>.</p>
      <div style="background:#1a2634;border:1px solid rgba(42,181,160,0.25);border-radius:10px;padding:24px;text-align:center;margin-bottom:28px">
        <span style="font-size:36px;font-weight:900;letter-spacing:10px;color:#2ab5a0">{otp}</span>
      </div>
      <p style="color:#64748b;font-size:12px;text-align:center">If you didn't create an AmroGen account, ignore this email.</p>
    </div>
    """
    await _send_transactional(to_email, "Verify your AmroGen account", html)


async def get_connection(db: AsyncSession, user_id: uuid.UUID) -> Optional[ResendConnection]:
    result = await db.execute(
        select(ResendConnection).where(ResendConnection.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def save_connection(
    db: AsyncSession,
    user_id: uuid.UUID,
    api_key: str,
    from_email: str,
    from_name: str,
) -> ResendConnection:
    result = await db.execute(
        select(ResendConnection).where(ResendConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    encrypted_key = encrypt_text(api_key)

    if conn:
        conn.api_key = encrypted_key
        conn.from_email = from_email
        conn.from_name = from_name
    else:
        conn = ResendConnection(
            user_id=user_id,
            api_key=encrypted_key,
            from_email=from_email,
            from_name=from_name,
        )
        db.add(conn)

    await db.commit()
    await db.refresh(conn)
    return conn


async def send_email(
    db: AsyncSession,
    user_id: uuid.UUID,
    to: str,
    subject: str,
    body: str,
) -> str:
    conn = await get_connection(db, user_id)
    if not conn:
        raise ValueError("Resend account not connected")
    api_key = decrypt_text(conn.api_key)
    from_field = f"{conn.from_name} <{conn.from_email}>"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={"from": from_field, "to": [to], "subject": subject, "html": body},
        )
    response.raise_for_status()
    return response.json().get("id", "")
