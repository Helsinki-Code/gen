from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser
from app.models.campaign import Campaign
from app.models.lead import Lead
from app.models.reply import Reply
from app.models.sequence import Sequence, SequenceStep

router = APIRouter(prefix="/inbox", tags=["inbox"])


@router.get("/count")
async def get_inbox_count(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    campaign_ids_r = await db.execute(
        select(Campaign.id).where(Campaign.user_id == current_user.id)
    )
    campaign_ids = list(campaign_ids_r.scalars())

    if not campaign_ids:
        return {"total": 0, "hot": 0, "approvals": 0}

    total_r = await db.execute(
        select(func.count(Reply.id)).where(Reply.campaign_id.in_(campaign_ids))
    )
    total = total_r.scalar() or 0

    hot_r = await db.execute(
        select(func.count(Reply.id)).where(
            Reply.campaign_id.in_(campaign_ids), Reply.intent == "HOT"
        )
    )
    hot = hot_r.scalar() or 0

    # Count campaigns waiting for user approval
    approvals_r = await db.execute(
        select(func.count(Campaign.id)).where(
            Campaign.id.in_(campaign_ids),
            Campaign.status.in_(["leads_review", "review"]),
        )
    )
    approvals = approvals_r.scalar() or 0

    return {"total": total, "hot": hot, "approvals": approvals}


@router.get("")
async def get_inbox(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    campaign_id: Optional[uuid.UUID] = Query(None),
    intent: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    campaign_ids_r = await db.execute(
        select(Campaign.id, Campaign.target_url).where(Campaign.user_id == current_user.id)
    )
    campaign_rows = campaign_ids_r.all()
    campaign_map = {row.id: row.target_url for row in campaign_rows}
    all_campaign_ids = list(campaign_map.keys())

    if not all_campaign_ids:
        return []

    filter_ids = [campaign_id] if campaign_id else all_campaign_ids

    intent_order = case(
        (Reply.intent == "HOT", 0),
        (Reply.intent == "WARM", 1),
        (Reply.intent == "NEUTRAL", 2),
        (Reply.intent == "OBJECTION", 3),
        (Reply.intent == "OUT_OF_OFFICE", 4),
        (Reply.intent == "UNSUBSCRIBE", 5),
        else_=6,
    )

    reply_q = (
        select(Reply)
        .where(Reply.campaign_id.in_(filter_ids))
        .order_by(intent_order, Reply.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    if intent:
        reply_q = reply_q.where(Reply.intent == intent)

    replies_r = await db.execute(reply_q)
    replies = replies_r.scalars().all()

    if not replies:
        return []

    seq_ids = list({r.sequence_id for r in replies if r.sequence_id})
    seqs_r = await db.execute(select(Sequence).where(Sequence.id.in_(seq_ids)))
    seq_map: dict[uuid.UUID, Sequence] = {s.id: s for s in seqs_r.scalars()}

    lead_ids = list({s.lead_id for s in seq_map.values() if s.lead_id})
    leads_r = await db.execute(select(Lead).where(Lead.id.in_(lead_ids)))
    lead_map: dict[uuid.UUID, Lead] = {ld.id: ld for ld in leads_r.scalars()}

    results = []
    for reply in replies:
        seq = seq_map.get(reply.sequence_id) if reply.sequence_id else None
        lead = lead_map.get(seq.lead_id) if seq else None

        outreach_step_data = None
        if seq:
            step_r = await db.execute(
                select(SequenceStep)
                .where(SequenceStep.sequence_id == seq.id, SequenceStep.status == "sent")
                .order_by(SequenceStep.sent_at.desc())
                .limit(1)
            )
            step = step_r.scalar_one_or_none()
            if step:
                outreach_step_data = {
                    "day": step.day,
                    "channel": step.channel,
                    "subject": step.subject,
                    "sent_at": step.sent_at.isoformat() if step.sent_at else None,
                }

        results.append({
            "reply_id": str(reply.id),
            "sequence_id": str(reply.sequence_id) if reply.sequence_id else None,
            "campaign_id": str(reply.campaign_id) if reply.campaign_id else None,
            "campaign_url": campaign_map.get(reply.campaign_id) if reply.campaign_id else None,
            "lead_name": reply.lead_name or (lead.name if lead else None),
            "company": reply.company or (lead.company if lead else None),
            "lead_title": lead.title if lead else None,
            "channel": reply.channel,
            "from_email": reply.from_email,
            "subject": reply.subject,
            "body_preview": reply.body_preview,
            "body_full": reply.body_full,
            "intent": reply.intent,
            "sentiment_score": reply.sentiment_score,
            "next_action": reply.next_action,
            "received_at": reply.received_at.isoformat() if reply.received_at else None,
            "created_at": reply.created_at.isoformat(),
            "sequence_status": seq.status if seq else None,
            "outreach_step": outreach_step_data,
        })

    return results
