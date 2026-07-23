from __future__ import annotations

import uuid
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.twilio_connection import TwilioConnection
from app.services.encryption import decrypt_text, encrypt_text


async def get_connection(db: AsyncSession, user_id: uuid.UUID) -> Optional[TwilioConnection]:
    result = await db.execute(
        select(TwilioConnection).where(TwilioConnection.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def save_connection(
    db: AsyncSession,
    user_id: uuid.UUID,
    account_sid: str,
    auth_token: str,
    from_number: str,
) -> TwilioConnection:
    result = await db.execute(
        select(TwilioConnection).where(TwilioConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    encrypted_sid = encrypt_text(account_sid)
    encrypted_token = encrypt_text(auth_token)

    if conn:
        conn.account_sid = encrypted_sid
        conn.auth_token = encrypted_token
        conn.from_number = from_number
    else:
        conn = TwilioConnection(
            user_id=user_id,
            account_sid=encrypted_sid,
            auth_token=encrypted_token,
            from_number=from_number,
        )
        db.add(conn)

    await db.commit()
    await db.refresh(conn)
    return conn


async def send_sms(
    db: AsyncSession,
    user_id: uuid.UUID,
    to: str,
    body: str,
) -> str:
    conn = await get_connection(db, user_id)
    if not conn:
        raise ValueError("Twilio account not connected")
    account_sid = decrypt_text(conn.account_sid)
    auth_token = decrypt_text(conn.auth_token)
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
            auth=(account_sid, auth_token),
            data={"From": conn.from_number, "To": to, "Body": body},
        )
    response.raise_for_status()
    return response.json().get("sid", "")
