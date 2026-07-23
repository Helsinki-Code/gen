from __future__ import annotations

import html
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.campaign import Campaign
from app.models.credit_transaction import CreditTransaction
from app.models.discovery import DiscoveryRun
from app.models.user import User
from app.services.resend_email import send_system_email


def _esc(value: object) -> str:
    return html.escape(str(value if value is not None else ""))


async def build_daily_digest(db: AsyncSession, *, hours: int = 24) -> dict[str, Any]:
    """Aggregate last-N-hours activity and issues for the ops digest email."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    new_users = int(
        (
            await db.execute(select(func.count()).select_from(User).where(User.created_at >= since))
        ).scalar_one()
        or 0
    )

    campaigns_created = int(
        (
            await db.execute(
                select(func.count()).select_from(Campaign).where(Campaign.created_at >= since)
            )
        ).scalar_one()
        or 0
    )

    campaign_status_rows = (
        await db.execute(
            select(Campaign.status, func.count())
            .where(Campaign.created_at >= since)
            .group_by(Campaign.status)
        )
    ).all()
    campaign_statuses = {str(status): int(count) for status, count in campaign_status_rows}

    failed_campaigns_result = await db.execute(
        select(Campaign, User.email)
        .join(User, Campaign.user_id == User.id)
        .where(
            Campaign.status == "failed",
            Campaign.updated_at >= since,
        )
        .order_by(desc(Campaign.updated_at))
        .limit(25)
    )
    failed_campaigns = [
        {
            "id": str(campaign.id),
            "email": email,
            "target_url": campaign.target_url,
            "error_message": (campaign.error_message or "")[:400],
            "updated_at": campaign.updated_at.isoformat() if campaign.updated_at else None,
        }
        for campaign, email in failed_campaigns_result.all()
    ]

    recent_campaigns_result = await db.execute(
        select(Campaign, User.email)
        .join(User, Campaign.user_id == User.id)
        .where(Campaign.created_at >= since)
        .order_by(desc(Campaign.created_at))
        .limit(25)
    )
    recent_campaigns = [
        {
            "id": str(campaign.id),
            "email": email,
            "target_url": campaign.target_url,
            "status": campaign.status,
            "leads_requested": campaign.leads_requested,
            "credits_charged": campaign.credits_charged,
            "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
        }
        for campaign, email in recent_campaigns_result.all()
    ]

    discovery_created = int(
        (
            await db.execute(
                select(func.count()).select_from(DiscoveryRun).where(DiscoveryRun.created_at >= since)
            )
        ).scalar_one()
        or 0
    )
    failed_discoveries_result = await db.execute(
        select(DiscoveryRun, User.email)
        .join(User, DiscoveryRun.user_id == User.id)
        .where(
            DiscoveryRun.status.in_(("failed", "error")),
            DiscoveryRun.updated_at >= since,
        )
        .order_by(desc(DiscoveryRun.updated_at))
        .limit(15)
    )
    failed_discoveries = [
        {
            "id": str(run.id),
            "email": email,
            "name": run.name,
            "error_message": (run.error_message or "")[:400],
        }
        for run, email in failed_discoveries_result.all()
    ]

    credit_rows = (
        await db.execute(
            select(CreditTransaction.type, func.count(), func.coalesce(func.sum(CreditTransaction.amount), 0))
            .where(CreditTransaction.created_at >= since)
            .group_by(CreditTransaction.type)
        )
    ).all()
    credit_activity = [
        {"type": str(tx_type), "count": int(count), "sum_amount": int(total or 0)}
        for tx_type, count, total in credit_rows
    ]

    new_user_rows = (
        await db.execute(
            select(User.email, User.created_at, User.credit_balance)
            .where(User.created_at >= since)
            .order_by(desc(User.created_at))
            .limit(20)
        )
    ).all()
    new_user_list = [
        {
            "email": email,
            "created_at": created_at.isoformat() if created_at else None,
            "credit_balance": int(balance or 0),
        }
        for email, created_at, balance in new_user_rows
    ]

    issue_count = len(failed_campaigns) + len(failed_discoveries)
    return {
        "since": since.isoformat(),
        "hours": hours,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "new_users": new_users,
            "campaigns_created": campaigns_created,
            "discovery_runs_created": discovery_created,
            "failed_campaigns": len(failed_campaigns),
            "failed_discoveries": len(failed_discoveries),
            "issue_count": issue_count,
            "campaign_statuses": campaign_statuses,
        },
        "new_users": new_user_list,
        "recent_campaigns": recent_campaigns,
        "failed_campaigns": failed_campaigns,
        "failed_discoveries": failed_discoveries,
        "credit_activity": credit_activity,
    }


def render_daily_digest_html(payload: dict[str, Any]) -> str:
    summary = payload.get("summary") or {}
    issue_count = int(summary.get("issue_count") or 0)
    issue_color = "#f87171" if issue_count else "#2ab5a0"

    def rows_html(items: list[dict[str, Any]], cols: list[tuple[str, str]]) -> str:
        if not items:
            return "<p style='color:#94a3b8;font-size:13px'>None in this window.</p>"
        head = "".join(f"<th style='text-align:left;padding:6px 8px;color:#94a3b8'>{_esc(label)}</th>" for _, label in cols)
        body_parts: list[str] = []
        for item in items:
            tds = "".join(
                f"<td style='padding:6px 8px;border-top:1px solid #1e293b;font-size:12px;color:#e2e8f0'>{_esc(item.get(key, ''))}</td>"
                for key, _ in cols
            )
            body_parts.append(f"<tr>{tds}</tr>")
        return (
            "<table style='width:100%;border-collapse:collapse;margin:8px 0 16px'>"
            f"<thead><tr>{head}</tr></thead><tbody>{''.join(body_parts)}</tbody></table>"
        )

    status_bits = summary.get("campaign_statuses") or {}
    status_line = ", ".join(f"{k}={v}" for k, v in sorted(status_bits.items())) or "none"

    credit_lines = "".join(
        f"<li style='margin:4px 0'>{_esc(row['type'])}: count={row['count']}, sum={row['sum_amount']}</li>"
        for row in (payload.get("credit_activity") or [])
    ) or "<li style='color:#94a3b8'>No credit transactions</li>"

    return f"""
    <div style="font-family:Inter,sans-serif;max-width:720px;margin:0 auto;padding:32px 20px;background:#0f1923;color:#e2e8f0;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px">
        <span style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#2ab5a0,#1ab7ea);-webkit-background-clip:text;-webkit-text-fill-color:transparent">AmroGen</span>
      </div>
      <h1 style="font-size:20px;margin:0 0 8px">Daily activity digest</h1>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 20px">
        Window: last {_esc(payload.get('hours'))}h · since {_esc(payload.get('since'))} · generated {_esc(payload.get('generated_at'))}
      </p>
      <div style="display:grid;gap:10px;margin-bottom:24px">
        <div style="background:#1a2634;border-radius:10px;padding:14px">
          <div style="font-size:12px;color:#94a3b8">New users</div>
          <div style="font-size:22px;font-weight:800">{_esc(summary.get('new_users'))}</div>
        </div>
        <div style="background:#1a2634;border-radius:10px;padding:14px">
          <div style="font-size:12px;color:#94a3b8">Campaigns created</div>
          <div style="font-size:22px;font-weight:800">{_esc(summary.get('campaigns_created'))}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px">{_esc(status_line)}</div>
        </div>
        <div style="background:#1a2634;border-radius:10px;padding:14px">
          <div style="font-size:12px;color:#94a3b8">Discovery runs</div>
          <div style="font-size:22px;font-weight:800">{_esc(summary.get('discovery_runs_created'))}</div>
        </div>
        <div style="background:#1a2634;border-radius:10px;padding:14px;border:1px solid {issue_color}33">
          <div style="font-size:12px;color:#94a3b8">Issues (failed campaigns + discoveries)</div>
          <div style="font-size:22px;font-weight:800;color:{issue_color}">{_esc(issue_count)}</div>
        </div>
      </div>

      <h2 style="font-size:16px;margin:0 0 8px">New users</h2>
      {rows_html(payload.get("new_users") or [], [("email", "Email"), ("credit_balance", "Credits"), ("created_at", "Created")])}

      <h2 style="font-size:16px;margin:0 0 8px">Campaigns (activity)</h2>
      {rows_html(payload.get("recent_campaigns") or [], [("email", "User"), ("status", "Status"), ("leads_requested", "Leads"), ("credits_charged", "Credits"), ("target_url", "URL")])}

      <h2 style="font-size:16px;margin:0 0 8px">Failed campaigns</h2>
      {rows_html(payload.get("failed_campaigns") or [], [("email", "User"), ("target_url", "URL"), ("error_message", "Error")])}

      <h2 style="font-size:16px;margin:0 0 8px">Failed discoveries</h2>
      {rows_html(payload.get("failed_discoveries") or [], [("email", "User"), ("name", "Name"), ("error_message", "Error")])}

      <h2 style="font-size:16px;margin:0 0 8px">Credit transactions</h2>
      <ul style="margin:0 0 16px;padding-left:18px;font-size:13px">{credit_lines}</ul>

      <p style="color:#64748b;font-size:11px;margin-top:24px;text-align:center">
        AmroGen ops digest · sent to configured DAILY_DIGEST_TO
      </p>
    </div>
    """


async def send_daily_digest(db: AsyncSession, *, hours: int = 24, to_email: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    recipient = (to_email or settings.daily_digest_to or "info@amrogen.com").strip()
    payload = await build_daily_digest(db, hours=hours)
    issue_count = int((payload.get("summary") or {}).get("issue_count") or 0)
    subject = (
        f"[AmroGen] Daily digest — {issue_count} issue(s)"
        if issue_count
        else "[AmroGen] Daily digest — all clear"
    )
    await send_system_email(recipient, subject, render_daily_digest_html(payload))
    return {"to": recipient, "issue_count": issue_count, "summary": payload.get("summary")}
