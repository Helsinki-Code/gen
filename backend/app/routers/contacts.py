from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser
from app.models.campaign import Campaign
from app.models.lead import Lead
from app.models.reply import Reply
from app.models.sequence import Sequence, SequenceStep

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("/stats")
async def get_contact_stats(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    campaign_ids_r = await db.execute(
        select(Campaign.id).where(Campaign.user_id == current_user.id)
    )
    campaign_ids = list(campaign_ids_r.scalars())

    if not campaign_ids:
        return {"total": 0, "active": 0, "replied": 0, "hot": 0, "converted": 0}

    total_r = await db.execute(
        select(func.count(Lead.id)).where(Lead.campaign_id.in_(campaign_ids))
    )
    total = total_r.scalar() or 0

    active_r = await db.execute(
        select(func.count(Sequence.id)).where(
            Sequence.campaign_id.in_(campaign_ids),
            Sequence.status.in_(["approved", "active"]),
        )
    )
    active = active_r.scalar() or 0

    replied_r = await db.execute(
        select(func.count(func.distinct(Reply.sequence_id))).where(
            Reply.campaign_id.in_(campaign_ids)
        )
    )
    replied = replied_r.scalar() or 0

    hot_r = await db.execute(
        select(func.count(func.distinct(Reply.sequence_id))).where(
            Reply.campaign_id.in_(campaign_ids),
            Reply.intent == "HOT",
        )
    )
    hot = hot_r.scalar() or 0

    converted_r = await db.execute(
        select(func.count(Sequence.id)).where(
            Sequence.campaign_id.in_(campaign_ids),
            Sequence.status == "converted",
        )
    )
    converted = converted_r.scalar() or 0

    return {"total": total, "active": active, "replied": replied, "hot": hot, "converted": converted}


@router.get("")
async def get_contacts(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    campaign_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    intent: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
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

    lead_q = select(Lead).where(Lead.campaign_id.in_(filter_ids))
    if search:
        like = f"%{search}%"
        lead_q = lead_q.where(Lead.name.ilike(like) | Lead.company.ilike(like))
    lead_q = lead_q.order_by(Lead.row_index).offset((page - 1) * per_page).limit(per_page)
    leads_r = await db.execute(lead_q)
    leads = leads_r.scalars().all()

    if not leads:
        return []

    lead_ids = [ld.id for ld in leads]

    seqs_r = await db.execute(select(Sequence).where(Sequence.lead_id.in_(lead_ids)))
    seqs_by_lead: dict[uuid.UUID, Sequence] = {}
    seq_ids = []
    for seq in seqs_r.scalars():
        seqs_by_lead[seq.lead_id] = seq
        seq_ids.append(seq.id)

    # Latest sent step per lead
    last_touch_r = await db.execute(
        select(SequenceStep.lead_id, func.max(SequenceStep.sent_at).label("last_at"))
        .where(SequenceStep.lead_id.in_(lead_ids), SequenceStep.status == "sent")
        .group_by(SequenceStep.lead_id)
    )
    last_touch_map: dict[uuid.UUID, datetime] = {r.lead_id: r.last_at for r in last_touch_r}

    last_touch_channel_map: dict[uuid.UUID, str] = {}
    for lead_id, last_at in last_touch_map.items():
        ch_r = await db.execute(
            select(SequenceStep.channel)
            .where(SequenceStep.lead_id == lead_id, SequenceStep.sent_at == last_at)
            .limit(1)
        )
        ch = ch_r.scalar_one_or_none()
        if ch:
            last_touch_channel_map[lead_id] = ch

    # Next scheduled step per lead
    next_touch_r = await db.execute(
        select(SequenceStep.lead_id, func.min(SequenceStep.scheduled_for).label("next_at"))
        .where(SequenceStep.lead_id.in_(lead_ids), SequenceStep.status == "scheduled")
        .group_by(SequenceStep.lead_id)
    )
    next_touch_at_map: dict[uuid.UUID, datetime] = {r.lead_id: r.next_at for r in next_touch_r}

    next_touch_day_map: dict[uuid.UUID, int] = {}
    for lead_id, next_at in next_touch_at_map.items():
        day_r = await db.execute(
            select(SequenceStep.day)
            .where(SequenceStep.lead_id == lead_id, SequenceStep.scheduled_for == next_at)
            .limit(1)
        )
        day = day_r.scalar_one_or_none()
        if day:
            next_touch_day_map[lead_id] = day

    # Latest reply per sequence
    reply_map: dict[uuid.UUID, Reply] = {}
    if seq_ids:
        replies_r = await db.execute(
            select(Reply)
            .where(Reply.sequence_id.in_(seq_ids))
            .order_by(Reply.created_at.desc())
        )
        seen: set[uuid.UUID] = set()
        for reply in replies_r.scalars():
            if reply.sequence_id not in seen:
                reply_map[reply.sequence_id] = reply
                seen.add(reply.sequence_id)

    results = []
    for lead in leads:
        seq = seqs_by_lead.get(lead.id)
        seq_status = seq.status if seq else None

        if status and seq_status != status:
            continue

        latest_reply = reply_map.get(seq.id) if seq else None
        reply_intent = latest_reply.intent if latest_reply else None

        if intent and reply_intent != intent:
            continue

        lt = last_touch_map.get(lead.id)
        nt = next_touch_at_map.get(lead.id)

        results.append({
            "lead_id": str(lead.id),
            "name": lead.name,
            "title": lead.title,
            "company": lead.company,
            "email": lead.email,
            "phone": lead.phone,
            "icp_fit_score": lead.icp_fit_score,
            "icp_fit": lead.icp_fit,
            "best_outreach_angle": lead.best_outreach_angle,
            "campaign_id": str(lead.campaign_id),
            "campaign_url": campaign_map.get(lead.campaign_id),
            "sequence_id": str(seq.id) if seq else None,
            "sequence_status": seq_status,
            "last_touch_channel": last_touch_channel_map.get(lead.id),
            "last_touch_at": lt.isoformat() if lt else None,
            "next_touch_at": nt.isoformat() if nt else None,
            "next_touch_day": next_touch_day_map.get(lead.id),
            "reply_intent": reply_intent,
            "reply_preview": latest_reply.body_preview if latest_reply else None,
        })

    return results
