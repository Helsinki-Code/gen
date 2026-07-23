from __future__ import annotations

import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.campaign import Campaign
from app.models.user import User

settings = get_settings()
router = APIRouter(tags=["stream"])

_POLL_INTERVAL = 1.0          # seconds between DB polls
_HEARTBEAT_AFTER = 5          # polls without events before sending heartbeat
_QUEUE_WARN_AFTER = 90        # seconds in "queued" before warning the frontend


async def _get_user_from_token(token: str, db: AsyncSession) -> User:
    from app.middleware.auth import _get_user_by_api_key, _get_user_by_jwt

    if token.startswith("amro_sk_"):
        user = await _get_user_by_api_key(db, token)
    else:
        user = await _get_user_by_jwt(db, token)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


def _asyncpg_dsn():
    url = settings.database_url
    dsn = url.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]
    ssl = "require" if ("ssl=require" in url or "sslmode=require" in url) else None
    return dsn, ssl


@router.get("/campaigns/{campaign_id}/stream")
async def stream_campaign_progress(
    campaign_id: uuid.UUID,
    token: str = Query(..., description="Auth token (EventSource cannot set headers)"),
    db: AsyncSession = Depends(get_db),
):
    current_user = await _get_user_from_token(token, db)

    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    initial_status = campaign.status

    async def event_generator():
        import asyncpg

        dsn, ssl = _asyncpg_dsn()
        conn = await asyncpg.connect(dsn=dsn, ssl=ssl)
        try:
            yield f"data: {json.dumps({'type': 'connected', 'campaign_id': str(campaign_id), 'status': initial_status})}\n\n"

            if initial_status in ("review", "complete", "failed"):
                yield f"data: {json.dumps({'type': 'status_change', 'status': initial_status})}\n\n"
                return

            channel = f"campaign:{campaign_id}:progress"
            last_event_id = 0
            queued_seconds = 0.0
            current_status = initial_status
            idle_polls = 0

            while True:
                rows = await conn.fetch(
                    "SELECT id, payload FROM campaign_events WHERE channel = $1 AND id > $2 ORDER BY id LIMIT 100",
                    channel,
                    last_event_id,
                )

                if rows:
                    idle_polls = 0
                    queued_seconds = 0.0
                    done = False
                    for row in rows:
                        last_event_id = row["id"]
                        payload = dict(row["payload"])
                        yield f"data: {json.dumps(payload)}\n\n"
                        if payload.get("type") == "status_change":
                            new_status = payload.get("status", "")
                            if new_status != "queued":
                                current_status = new_status
                            if new_status in ("review", "complete", "failed"):
                                done = True
                                break
                    if done:
                        break
                else:
                    idle_polls += 1
                    if idle_polls >= _HEARTBEAT_AFTER:
                        yield ": heartbeat\n\n"
                        idle_polls = 0

                    if current_status == "queued":
                        queued_seconds += _POLL_INTERVAL
                        if queued_seconds >= _QUEUE_WARN_AFTER:
                            yield f"data: {json.dumps({'type': 'queue_warning', 'message': 'Pipeline worker may not be running. Check Cloud Run worker service.'})}\n\n"

                await asyncio.sleep(_POLL_INTERVAL)
        finally:
            await conn.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
