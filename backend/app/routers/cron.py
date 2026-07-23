from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.services.admin_issue_notify import maybe_notify_critical_failure
from app.services.daily_digest import send_daily_digest
from app.services.keys_topup_report import send_keys_topup_report

router = APIRouter(prefix="/internal/cron", tags=["cron"])
_log = logging.getLogger("amrogen.cron")


def _require_cron_secret(authorization: str | None) -> None:
    settings = get_settings()
    expected = (settings.cron_secret or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="CRON_SECRET is not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Invalid cron secret")


def _truthy_query(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in ("1", "true", "yes", "on")


@router.post("/daily-digest")
async def trigger_daily_digest(
    authorization: str | None = Header(default=None),
    hours: int = Query(default=24, ge=1, le=168),
    to: str | None = Query(default=None, description="Override recipient; default DAILY_DIGEST_TO"),
    db: AsyncSession = Depends(get_db),
):
    """Send the daily activity + issues digest. Call from Cloud Scheduler or manually."""
    _require_cron_secret(authorization)
    settings = get_settings()
    if not settings.daily_digest_enabled:
        return {"ok": False, "skipped": True, "reason": "DAILY_DIGEST_ENABLED is false"}
    result = await send_daily_digest(db, hours=hours, to_email=to)
    return {"ok": True, **result}


@router.get("/keys-topup-report")
async def trigger_keys_topup_report(
    authorization: str | None = Header(default=None),
    dryRun: str | None = Query(default=None, alias="dryRun"),
    dry_run: str | None = Query(default=None),
    onlyOnIssues: str | None = Query(default=None, alias="onlyOnIssues"),
    only_on_issues: str | None = Query(default=None),
):
    """Probe Gemini, Resend, Stripe, DB and email the daily keys/top-up report."""
    _require_cron_secret(authorization)
    dry = _truthy_query(dryRun) or _truthy_query(dry_run)
    only_issues = _truthy_query(onlyOnIssues) or _truthy_query(only_on_issues)

    try:
        result = await send_keys_topup_report(dry_run=dry, only_on_issues=only_issues)
    except Exception as exc:  # noqa: BLE001
        _log.exception("keys-topup-report failed: %s", exc)
        await maybe_notify_critical_failure(
            title="Keys / top-up cron failed",
            summary=str(exc),
            details={"endpoint": "/internal/cron/keys-topup-report"},
            dedupe_key="cron:keys-topup-report:failure",
        )
        raise HTTPException(status_code=500, detail=str(exc) or "Cron failed") from exc

    report = result.get("report") or {}
    # Always email on issues is handled inside send_keys_topup_report.
    # If action required and send skipped for other reasons, still surface clearly.
    if report.get("action_required") and result.get("sent") is False and not dry and not result.get("skipped"):
        await maybe_notify_critical_failure(
            title="Keys / top-up issues (email not sent)",
            summary="; ".join(report.get("issues") or [])[:500],
            details={"to": result.get("to"), "reason": result.get("reason")},
            dedupe_key="cron:keys-topup-report:issues-unsent",
        )

    slim_report = (
        report
        if dry
        else {
            "generated_at": report.get("generated_at"),
            "action_required": report.get("action_required"),
            "issues": report.get("issues"),
            "gemini_ok": (report.get("amrogen") or {}).get("gemini", {}).get("ok"),
            "resend_ok": (report.get("amrogen") or {}).get("resend", {}).get("ok"),
            "stripe": (report.get("amrogen") or {}).get("stripe"),
            "database_ok": (report.get("amrogen") or {}).get("database", {}).get("ok"),
        }
    )
    return {"ok": True, "success": True, **{k: v for k, v in result.items() if k != "report"}, "report": slim_report}
