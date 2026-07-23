"""Notify ops (info@amrogen.com) on critical platform failures. Rate-limited per signature."""
from __future__ import annotations

import html
import logging
import time
from typing import Any

from app.config import get_settings
from app.services.resend_email import send_system_email

_log = logging.getLogger("amrogen.admin_issue")

DEFAULT_DEDUPE_MS = 30 * 60 * 1000
_recent_alerts: dict[str, float] = {}


def get_admin_issue_email() -> str:
    settings = get_settings()
    return (
        (settings.admin_issue_email or "").strip()
        or (settings.daily_digest_to or "").strip()
        or "info@amrogen.com"
    )


def is_admin_issue_notify_enabled() -> bool:
    settings = get_settings()
    flag = (settings.admin_issue_notify or "").strip().lower()
    if flag in ("false", "0", "no", "off"):
        return False
    if flag in ("true", "1", "yes", "on"):
        return True
    return settings.environment == "production"


def _is_dedupe_blocked(key: str, now_ms: float | None = None, dedupe_ms: int = DEFAULT_DEDUPE_MS) -> bool:
    now = now_ms if now_ms is not None else time.time() * 1000
    last = _recent_alerts.get(key)
    return isinstance(last, (int, float)) and (now - last) < dedupe_ms


def _mark_dedupe(key: str, now_ms: float | None = None) -> None:
    now = now_ms if now_ms is not None else time.time() * 1000
    _recent_alerts[key] = now
    if len(_recent_alerts) > 500:
        cutoff = now - DEFAULT_DEDUPE_MS
        for k, ts in list(_recent_alerts.items()):
            if ts < cutoff:
                del _recent_alerts[k]


def _esc(value: object) -> str:
    return html.escape(str(value if value is not None else ""))


async def notify_admin_issue(payload: dict[str, Any]) -> dict[str, Any]:
    """Send a critical issue email. payload: title, summary?, details?, dedupe_key?."""
    if not is_admin_issue_notify_enabled():
        return {"sent": False, "reason": "disabled"}

    settings = get_settings()
    if not (settings.resend_api_key or "").strip():
        _log.warning("RESEND_API_KEY not set; skipping admin issue notification")
        return {"sent": False, "reason": "no_resend"}

    admin_to = get_admin_issue_email()
    if not admin_to:
        return {"sent": False, "reason": "no_recipient"}

    dedupe_key = payload.get("dedupe_key")
    if isinstance(dedupe_key, str) and dedupe_key and _is_dedupe_blocked(dedupe_key):
        return {"sent": False, "reason": "deduped"}

    details = payload.get("details")
    rows = ""
    if isinstance(details, dict):
        rows = "".join(
            f"<tr><td><strong>{_esc(k)}</strong></td><td>{_esc(v)}</td></tr>"
            for k, v in details.items()
            if v is not None
        )

    title = str(payload.get("title") or "AmroGen critical issue")
    summary = str(payload.get("summary") or "")
    html_body = f"""
    <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111">
      <h2 style="font-size:18px;margin:0 0 12px">{_esc(title)}</h2>
      {"<p>" + _esc(summary) + "</p>" if summary else ""}
      {"<table style='border-collapse:collapse;width:100%'>" + rows + "</table>" if rows else ""}
      <p style="font-size:12px;color:#9ca3af;margin-top:24px">AmroGen admin issue notify</p>
    </div>
    """

    try:
        await send_system_email(admin_to, f"[AmroGen] {title}", html_body)
    except Exception as exc:  # noqa: BLE001
        _log.exception("admin issue email failed: %s", exc)
        return {"sent": False, "reason": "send_failed", "error": str(exc)}

    if isinstance(dedupe_key, str) and dedupe_key:
        _mark_dedupe(dedupe_key)
    return {"sent": True, "to": admin_to}


async def maybe_notify_critical_failure(
    *,
    title: str,
    summary: str,
    details: dict[str, Any] | None = None,
    dedupe_key: str | None = None,
) -> dict[str, Any]:
    """Convenience wrapper for exception handlers / ops alerts."""
    return await notify_admin_issue(
        {
            "title": title,
            "summary": summary,
            "details": details or {},
            "dedupe_key": dedupe_key,
        }
    )
