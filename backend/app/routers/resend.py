from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser
from app.models.resend_connection import ResendConnection
from app.schemas.resend import ResendConnect, ResendStatus
from app.services import resend_email as svc

router = APIRouter(prefix="/resend", tags=["resend"])


@router.post("/connect", response_model=ResendStatus)
async def connect_resend(
    body: ResendConnect,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    conn = await svc.save_connection(
        db, current_user.id, body.api_key, body.from_email, body.from_name
    )
    return ResendStatus(connected=True, from_email=conn.from_email, from_name=conn.from_name)


@router.get("/status", response_model=ResendStatus)
async def resend_status(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    conn = await svc.get_connection(db, current_user.id)
    return ResendStatus(
        connected=conn is not None,
        from_email=conn.from_email if conn else None,
        from_name=conn.from_name if conn else None,
    )


@router.delete("/disconnect", status_code=204)
async def disconnect_resend(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(ResendConnection).where(ResendConnection.user_id == current_user.id))
    await db.commit()
