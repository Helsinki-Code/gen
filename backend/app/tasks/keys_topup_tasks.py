from __future__ import annotations

import asyncio
import logging

from app.tasks.worker_app import worker_app

_log = logging.getLogger("amrogen.keys_topup")


@worker_app.periodic(cron="15 7 * * *")  # 07:15 UTC daily (Cloud Scheduler is preferred)
@worker_app.task(name="send_keys_topup_report_task")
def send_keys_topup_report_task(timestamp: int | None = None) -> dict:
    """Procrastinate daily keys/Stripe/DB probe → DAILY_KEYS_REPORT_EMAIL."""
    return asyncio.run(_send_keys_topup_async())


async def _send_keys_topup_async() -> dict:
    from app.config import get_settings
    from app.services.keys_topup_report import send_keys_topup_report

    settings = get_settings()
    if not settings.resend_api_key:
        _log.warning("Keys top-up report skipped (RESEND_API_KEY missing)")
        return {"ok": False, "skipped": True, "reason": "no_resend"}

    result = await send_keys_topup_report(dry_run=False, only_on_issues=False)
    _log.info(
        "Keys top-up report sent=%s to=%s action_required=%s",
        result.get("sent"),
        result.get("to"),
        (result.get("report") or {}).get("action_required"),
    )
    return {"ok": True, **{k: v for k, v in result.items() if k != "report"}}
