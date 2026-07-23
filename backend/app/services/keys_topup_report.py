"""Daily ops report: AmroGen API keys, Stripe, DB, Resend.

Used by GET /internal/cron/keys-topup-report → emails info@amrogen.com.
"""
from __future__ import annotations

import asyncio
import html
import os
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import text

from app.config import get_settings
from app.database import engine
from app.services.admin_issue_notify import get_admin_issue_email
from app.services.resend_email import send_system_email

_PLACEHOLDER_RE = re.compile(r"^your[_-]", re.IGNORECASE)


def _env_present(name: str) -> bool:
    value = (os.environ.get(name) or "").strip()
    return bool(value) and not _PLACEHOLDER_RE.match(value) and value != "changeme"


def _env_value(*names: str) -> str:
    for name in names:
        value = (os.environ.get(name) or "").strip()
        if value and not _PLACEHOLDER_RE.match(value) and value != "changeme":
            return value
    return ""


def _esc(value: object) -> str:
    return html.escape(str(value if value is not None else ""))


def _status_label(check: dict[str, Any]) -> str:
    if check.get("skipped"):
        return "skipped (not set)"
    if not check.get("configured") and not check.get("ok"):
        return str(check.get("error") or "missing")
    if check.get("ok"):
        return "ok"
    return str(check.get("error") or "invalid")


def _row(label: str, value: str, *, bad: bool = False) -> str:
    color = "#b91c1c" if bad else "#166534"
    return (
        f'<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">{_esc(label)}</td>'
        f'<td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;color:{color};font-weight:600">'
        f"{_esc(value)}</td></tr>"
    )


async def check_gemini() -> dict[str, Any]:
    """Live Gemini probe (models list, then tiny generate fallback)."""
    settings = get_settings()
    api_key = _env_value("GEMINI_API_KEY", "GOOGLE_AI_API_KEY") or (settings.gemini_api_key or "").strip()
    if not api_key or _PLACEHOLDER_RE.match(api_key) or api_key == "changeme":
        return {"configured": False, "ok": False, "error": "GEMINI_API_KEY / GOOGLE_AI_API_KEY not set"}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            models_res = await client.get(
                "https://generativelanguage.googleapis.com/v1beta/models",
                params={"key": api_key, "pageSize": "1"},
            )
            if models_res.is_success:
                return {"configured": True, "ok": True, "method": "models_list"}

            # Fallback: tiny generate (same pattern as Amropilot)
            gen_url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                "gemini-2.0-flash:generateContent"
            )
            gen_res = await client.post(
                gen_url,
                params={"key": api_key},
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": "Reply with OK"}]}],
                    "generationConfig": {"maxOutputTokens": 8},
                },
            )
            if gen_res.is_success:
                return {"configured": True, "ok": True, "method": "generate"}

            body = (gen_res.text or models_res.text or "")[:160]
            return {
                "configured": True,
                "ok": False,
                "error": f"Gemini HTTP {gen_res.status_code}: {body}",
            }
    except Exception as exc:  # noqa: BLE001
        return {
            "configured": True,
            "ok": False,
            "error": str(exc) or "Gemini probe failed",
        }


def check_resend() -> dict[str, Any]:
    settings = get_settings()
    if not (settings.resend_api_key or "").strip() and not _env_present("RESEND_API_KEY"):
        return {"configured": False, "ok": False, "error": "RESEND_API_KEY not set"}
    return {"configured": True, "ok": True}


async def check_stripe() -> dict[str, Any]:
    """Stripe balance, or Account.retrieve fallback if balance fails."""
    settings = get_settings()
    secret = (settings.stripe_secret_key or "").strip() or _env_value("STRIPE_SECRET_KEY")
    if not secret:
        return {
            "configured": False,
            "ok": True,
            "skipped": True,
            "error": "STRIPE_SECRET_KEY not set (optional until payments go live)",
        }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            bal_res = await client.get(
                "https://api.stripe.com/v1/balance",
                auth=(secret, ""),
            )
            if bal_res.is_success:
                body = bal_res.json()
                available = body.get("available") if isinstance(body, dict) else None
                return {
                    "configured": True,
                    "ok": True,
                    "method": "balance",
                    "available": available,
                }

            acct_res = await client.get(
                "https://api.stripe.com/v1/account",
                auth=(secret, ""),
            )
            if acct_res.is_success:
                acct = acct_res.json()
                acct_id = acct.get("id") if isinstance(acct, dict) else None
                return {
                    "configured": True,
                    "ok": True,
                    "method": "account",
                    "account_id": acct_id,
                }

            snippet = (acct_res.text or bal_res.text or "")[:160]
            return {
                "configured": True,
                "ok": False,
                "error": f"Stripe HTTP {acct_res.status_code or bal_res.status_code}: {snippet}",
            }
    except Exception as exc:  # noqa: BLE001
        return {
            "configured": True,
            "ok": False,
            "error": str(exc) or "Stripe probe failed",
        }


async def check_database() -> dict[str, Any]:
    try:
        started = datetime.now(timezone.utc)
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        latency_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        return {"configured": True, "ok": True, "latency_ms": latency_ms}
    except Exception as exc:  # noqa: BLE001
        return {
            "configured": True,
            "ok": False,
            "error": str(exc) or "DB connectivity failed",
        }


async def build_keys_topup_report() -> dict[str, Any]:
    gemini, stripe, database = await asyncio.gather(
        check_gemini(),
        check_stripe(),
        check_database(),
    )
    resend = check_resend()

    issues: list[str] = []
    if not gemini.get("ok"):
        issues.append(f"Gemini: {gemini.get('error') or 'invalid'}")
    if not resend.get("ok"):
        issues.append(f"Resend: {resend.get('error') or 'missing'}")
    if stripe.get("configured") and not stripe.get("ok"):
        issues.append(f"Stripe: {stripe.get('error') or 'invalid'}")
    if not database.get("ok"):
        issues.append(f"Database: {database.get('error') or 'unreachable'}")

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "amrogen": {
            "gemini": gemini,
            "resend": resend,
            "stripe": stripe,
            "database": database,
        },
        "local_env": {
            "gemini": _env_present("GEMINI_API_KEY")
            or _env_present("GOOGLE_AI_API_KEY")
            or bool((get_settings().gemini_api_key or "").strip()),
            "resend": _env_present("RESEND_API_KEY") or bool((get_settings().resend_api_key or "").strip()),
            "stripe": _env_present("STRIPE_SECRET_KEY")
            or bool((get_settings().stripe_secret_key or "").strip()),
            "database_url": bool((get_settings().database_url or "").strip()),
        },
        "issues": issues,
        "action_required": len(issues) > 0,
    }


def format_keys_topup_html(report: dict[str, Any]) -> str:
    action = bool(report.get("action_required"))
    title = (
        "ACTION REQUIRED — AmroGen keys / Stripe / DB"
        if action
        else "OK — AmroGen daily keys & top-up"
    )
    issues = report.get("issues") or []
    issues_block = (
        f"<ul>{''.join(f'<li>{_esc(i)}</li>' for i in issues)}</ul>"
        if issues
        else "<p>No issues detected.</p>"
    )
    a = report.get("amrogen") or {}
    gemini = a.get("gemini") or {}
    resend = a.get("resend") or {}
    stripe = a.get("stripe") or {}
    database = a.get("database") or {}

    stripe_detail = _status_label(stripe)
    if stripe.get("ok") and stripe.get("method") == "balance":
        stripe_detail = "ok (balance)"
    elif stripe.get("ok") and stripe.get("method") == "account":
        stripe_detail = f"ok (account {stripe.get('account_id') or ''})".strip()

    db_detail = _status_label(database)
    if database.get("ok") and "latency_ms" in database:
        db_detail = f"ok ({database['latency_ms']}ms)"

    return f"""<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.45;color:#111">
<h1 style="font-size:18px">{_esc(title)}</h1>
<p style="color:#6b7280">Generated {_esc(report.get("generated_at"))}</p>
<h2 style="font-size:15px">Issues</h2>
{issues_block}
<h2 style="font-size:15px">AmroGen</h2>
<table style="border-collapse:collapse;width:100%;max-width:640px;margin:16px 0">
{_row("Gemini / Google AI", _status_label(gemini), bad=not bool(gemini.get("ok")))}
{_row("Resend", _status_label(resend), bad=not bool(resend.get("ok")))}
{_row("Stripe", stripe_detail, bad=bool(stripe.get("configured") and not stripe.get("ok")))}
{_row("Database", db_detail, bad=not bool(database.get("ok")))}
</table>
<p style="font-size:12px;color:#9ca3af">Recipient: ops daily cron · AmroGen → info@amrogen.com</p>
</body></html>"""


def _report_recipient() -> str:
    settings = get_settings()
    return (
        (settings.daily_keys_report_email or "").strip()
        or (settings.daily_digest_to or "").strip()
        or get_admin_issue_email()
        or "info@amrogen.com"
    )


async def send_keys_topup_report(
    *,
    dry_run: bool = False,
    only_on_issues: bool = False,
) -> dict[str, Any]:
    report = await build_keys_topup_report()
    to = _report_recipient()
    action_required = bool(report.get("action_required"))

    if only_on_issues and not action_required:
        return {"sent": False, "skipped": True, "reason": "no_issues", "to": to, "report": report}

    subject = (
        "[AmroGen] ACTION: keys / Stripe / DB"
        if action_required
        else "[AmroGen] Daily keys & top-up OK"
    )

    if dry_run:
        return {"sent": False, "dry_run": True, "to": to, "subject": subject, "report": report}

    await send_system_email(to, subject, format_keys_topup_html(report))
    return {"sent": True, "to": to, "subject": subject, "report": report}
