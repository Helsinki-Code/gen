from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser
from app.models.twilio_connection import TwilioConnection
from app.schemas.twilio_sms import TwilioConnect, TwilioStatus
from app.services import twilio_sms as svc

router = APIRouter(prefix="/twilio", tags=["twilio"])


@router.post("/connect", response_model=TwilioStatus)
async def connect_twilio(
    body: TwilioConnect,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    conn = await svc.save_connection(
        db, current_user.id, body.account_sid, body.auth_token, body.from_number
    )
    return TwilioStatus(connected=True, from_number=conn.from_number)


@router.get("/status", response_model=TwilioStatus)
async def twilio_status(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    conn = await svc.get_connection(db, current_user.id)
    return TwilioStatus(connected=conn is not None, from_number=conn.from_number if conn else None)


@router.delete("/disconnect", status_code=204)
async def disconnect_twilio(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(TwilioConnection).where(TwilioConnection.user_id == current_user.id))
    await db.commit()
