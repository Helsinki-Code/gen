from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser
from app.models.user import User

router = APIRouter(prefix="/settings/schedule", tags=["schedule"])

VALID_MODES = {"manual", "daily", "weekly", "biweekly"}
VALID_DAYS = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}


class ScheduleConfig(BaseModel):
    enabled: bool = False
    mode: str = "manual"           # manual | daily | weekly | biweekly
    send_time: str = "09:00"       # HH:MM
    days: list[str] = []           # days of week for weekly/biweekly
    timezone: str = "UTC"


@router.get("")
async def get_schedule(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    config = current_user.schedule_config or {}
    return ScheduleConfig(**config).model_dump()


@router.put("")
async def update_schedule(
    body: ScheduleConfig,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if body.mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode: {body.mode}")
    for d in body.days:
        if d not in VALID_DAYS:
            raise HTTPException(status_code=400, detail=f"Invalid day: {d}")
    # Validate HH:MM format
    parts = body.send_time.split(":")
    if len(parts) != 2 or not all(p.isdigit() for p in parts):
        raise HTTPException(status_code=400, detail="send_time must be HH:MM")
    h, m = int(parts[0]), int(parts[1])
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise HTTPException(status_code=400, detail="Invalid time")

    config = body.model_dump()
    await db.execute(
        update(User).where(User.id == current_user.id).values(schedule_config=config)
    )
    await db.commit()
    return config
