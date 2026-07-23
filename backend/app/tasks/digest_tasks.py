from __future__ import annotations

import asyncio
import logging

from app.tasks.worker_app import worker_app

_log = logging.getLogger("amrogen.digest")


@worker_app.periodic(cron="0 8 * * *")  # 08:00 UTC daily
@worker_app.task(name="send_daily_digest_task")
def send_daily_digest_task(timestamp: int | None = None) -> dict:
    """Procrastinate daily digest — activity + failures to DAILY_DIGEST_TO."""
    return asyncio.run(_send_daily_digest_async())


async def _send_daily_digest_async() -> dict:
    from app.config import get_settings
    from app.database import AsyncSessionLocal
    from app.services.daily_digest import send_daily_digest

    settings = get_settings()
    if not settings.daily_digest_enabled:
        _log.info("Daily digest skipped (DAILY_DIGEST_ENABLED=false)")
        return {"ok": False, "skipped": True}
    if not settings.resend_api_key:
        _log.warning("Daily digest skipped (RESEND_API_KEY missing)")
        return {"ok": False, "skipped": True, "reason": "no_resend"}

    async with AsyncSessionLocal() as db:
        result = await send_daily_digest(db, hours=24)
        _log.info("Daily digest sent to %s issues=%s", result.get("to"), result.get("issue_count"))
        return {"ok": True, **result}
