from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import CurrentUser
from app.models.campaign import Campaign
from app.models.lead import Lead
from app.models.sequence import Sequence, SequenceStep
from app.schemas.campaign import CampaignCreate, CampaignListOut, CampaignOut
from app.schemas.lead import LeadOut
from app.schemas.reply import ReplyCreate, ReplyOut
from app.schemas.sequence import SequenceOut, SequenceUpdate
from app.services import credits as credits_svc

settings = get_settings()
router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _slug(url: str) -> str:
    host = urlparse(url).netloc or url
    return re.sub(r"[^a-z0-9]+", "_", host.lower()).strip("_")[:50]


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    body: CampaignCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    # Deduct credits upfront — scales with lead count (8 credits per 10 leads)
    import math
    credits_needed = math.ceil(body.leads_requested / 10) * settings.credits_per_pipeline
    try:
        await credits_svc.deduct(
            db,
            user_id=current_user.id,
            amount=credits_needed,
            description=f"Pipeline for {body.target_url}",
        )
    except credits_svc.InsufficientCreditsError as e:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Have {e.balance}, need {e.required}.",
        )

    campaign = Campaign(
        user_id=current_user.id,
        target_url=body.target_url,
        leads_requested=body.leads_requested,
        batch_size=body.batch_size,
        slug=_slug(body.target_url),
        status="queued",
        credits_charged=credits_needed,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    # Update credit transaction with campaign_id
    from app.models.credit_transaction import CreditTransaction
    from sqlalchemy import update

    await db.execute(
        update(CreditTransaction)
        .where(
            CreditTransaction.user_id == current_user.id,
            CreditTransaction.campaign_id.is_(None),
            CreditTransaction.type == "pipeline_run",
        )
        .values(campaign_id=campaign.id)
        .execution_options(synchronize_session=False)
    )
    await db.commit()

    from app.tasks.pipeline_tasks import run_pipeline_task
    from app.tasks.worker_app import ensure_worker_open
    await ensure_worker_open()
    await run_pipeline_task.defer_async(campaign_id=str(campaign.id))

    return await _campaign_out(db, campaign)


@router.get("", response_model=list[CampaignListOut])
async def list_campaigns(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    per_page: int = 20,
):
    offset = (page - 1) * per_page
    result = await db.execute(
        select(Campaign)
        .where(Campaign.user_id == current_user.id)
        .order_by(Campaign.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    return result.scalars().all()


@router.get("/{campaign_id}", response_model=CampaignOut)
async def get_campaign(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_or_404(db, campaign_id, current_user.id)
    return await _campaign_out(db, campaign)


@router.get("/{campaign_id}/leads", response_model=list[LeadOut])
async def get_leads(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_campaign_or_404(db, campaign_id, current_user.id)
    result = await db.execute(
        select(Lead).where(Lead.campaign_id == campaign_id).order_by(Lead.row_index)
    )
    return result.scalars().all()


@router.get("/{campaign_id}/sequences", response_model=list[SequenceOut])
async def get_sequences(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_campaign_or_404(db, campaign_id, current_user.id)
    result = await db.execute(
        select(Sequence)
        .where(Sequence.campaign_id == campaign_id)
        .options(selectinload(Sequence.steps), selectinload(Sequence.lead))
    )
    return result.scalars().all()


@router.put("/{campaign_id}/sequences/{seq_id}", response_model=SequenceOut)
async def update_sequence(
    campaign_id: uuid.UUID,
    seq_id: uuid.UUID,
    body: SequenceUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_campaign_or_404(db, campaign_id, current_user.id)
    result = await db.execute(
        select(Sequence).where(Sequence.id == seq_id, Sequence.campaign_id == campaign_id)
    )
    seq = result.scalar_one_or_none()
    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")

    if body.status:
        seq.status = body.status
        if body.status == "approved":
            seq.approved_by = current_user.id
            seq.approved_at = datetime.now(timezone.utc)
            await _schedule_steps(db, seq, current_user.id)
    await db.commit()
    refreshed = await db.execute(
        select(Sequence)
        .where(Sequence.id == seq_id)
        .options(selectinload(Sequence.steps), selectinload(Sequence.lead))
    )
    return refreshed.scalar_one()


@router.post("/{campaign_id}/confirm-leads")
async def confirm_leads(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    removed_lead_ids: list[uuid.UUID] = [],
):
    """HITL gate 1: user approves (optionally removing) leads before sequences are generated."""
    campaign = await _get_campaign_or_404(db, campaign_id, current_user.id)
    if campaign.status != "leads_review":
        raise HTTPException(status_code=400, detail="Campaign is not awaiting lead review")

    # Remove any leads the user deselected
    if removed_lead_ids:
        from sqlalchemy import delete as sa_delete
        await db.execute(
            sa_delete(Lead).where(
                Lead.campaign_id == campaign_id,
                Lead.id.in_(removed_lead_ids),
            )
        )

    campaign.status = "leads_ready"
    await db.commit()

    from app.tasks.pipeline_tasks import generate_sequences_task
    from app.tasks.worker_app import ensure_worker_open
    await ensure_worker_open()
    await generate_sequences_task.defer_async(campaign_id=str(campaign_id))

    return {"message": "Leads confirmed. Generating sequences now."}


@router.post("/{campaign_id}/approve-all")
async def approve_all_sequences(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_or_404(db, campaign_id, current_user.id)
    result = await db.execute(
        select(Sequence).where(
            Sequence.campaign_id == campaign_id, Sequence.status == "pending"
        )
    )
    sequences = result.scalars().all()
    now = datetime.now(timezone.utc)
    for seq in sequences:
        seq.status = "approved"
        seq.approved_by = current_user.id
        seq.approved_at = now
        await _schedule_steps(db, seq, current_user.id)

    campaign.status = "approved"
    await db.commit()
    return {"approved": len(sequences)}


@router.post("/{campaign_id}/send")
async def trigger_send(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    sender_name: str = "",
):
    campaign = await _get_campaign_or_404(db, campaign_id, current_user.id)
    if campaign.status not in ("approved", "review"):
        raise HTTPException(status_code=400, detail="Campaign must be approved before sending")

    from app.services.gmail import get_connection as _get_gmail
    from app.services import resend_email as _resend_svc
    resend_conn = await _resend_svc.get_connection(db, current_user.id)
    gmail_conn  = await _get_gmail(db, current_user.id)
    if not resend_conn and not gmail_conn:
        raise HTTPException(
            status_code=400,
            detail="Connect Gmail or Resend in Settings before sending.",
        )

    if sender_name:
        await _replace_sender_placeholder(db, campaign_id, sender_name)

    campaign.status = "sending"
    await db.commit()

    from app.tasks.scheduler_tasks import send_day1_steps_task
    from app.tasks.worker_app import ensure_worker_open
    await ensure_worker_open()
    await send_day1_steps_task.defer_async(campaign_id=str(campaign_id))

    return {"message": "Sending started. Day 1 steps dispatched immediately."}


@router.get("/{campaign_id}/stats")
async def get_campaign_stats(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_campaign_or_404(db, campaign_id, current_user.id)
    from app.models.reply import Reply
    from app.models.sequence import SequenceStep as Step

    step_counts_r = await db.execute(
        select(SequenceStep.status, func.count().label("n"))
        .where(
            SequenceStep.lead_id.in_(
                select(Lead.id).where(Lead.campaign_id == campaign_id)
            )
        )
        .group_by(SequenceStep.status)
    )
    step_counts = {row.status: row.n for row in step_counts_r}

    seq_counts_r = await db.execute(
        select(Sequence.status, func.count().label("n"))
        .where(Sequence.campaign_id == campaign_id)
        .group_by(Sequence.status)
    )
    seq_counts = {row.status: row.n for row in seq_counts_r}

    reply_counts_r = await db.execute(
        select(Reply.intent, func.count().label("n"))
        .where(Reply.campaign_id == campaign_id)
        .group_by(Reply.intent)
    )
    reply_counts = {row.intent: row.n for row in reply_counts_r}

    next_send_r = await db.execute(
        select(SequenceStep.scheduled_for)
        .where(
            SequenceStep.status == "scheduled",
            SequenceStep.lead_id.in_(
                select(Lead.id).where(Lead.campaign_id == campaign_id)
            ),
        )
        .order_by(SequenceStep.scheduled_for)
        .limit(1)
    )
    next_send = next_send_r.scalar_one_or_none()

    total_replies = sum(reply_counts.values())
    hot_replies = reply_counts.get("HOT", 0)

    return {
        "total_steps": sum(step_counts.values()),
        "sent": step_counts.get("sent", 0),
        "scheduled": step_counts.get("scheduled", 0),
        "failed": step_counts.get("failed", 0),
        "skipped": step_counts.get("skipped", 0),
        "sequences_active": seq_counts.get("active", 0) + seq_counts.get("approved", 0),
        "sequences_paused": seq_counts.get("paused", 0),
        "sequences_stopped": seq_counts.get("stopped", 0),
        "replies_total": total_replies,
        "replies_hot": hot_replies,
        "next_send_at": next_send.isoformat() if next_send else None,
    }


@router.get("/{campaign_id}/replies", response_model=list[ReplyOut])
async def get_replies(
    campaign_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_campaign_or_404(db, campaign_id, current_user.id)
    from app.models.reply import Reply
    result = await db.execute(
        select(Reply)
        .where(Reply.campaign_id == campaign_id)
        .order_by(Reply.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{campaign_id}/replies", response_model=ReplyOut, status_code=status.HTTP_201_CREATED)
async def log_reply(
    campaign_id: uuid.UUID,
    body: ReplyCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_campaign_or_404(db, campaign_id, current_user.id)
    from app.models.reply import Reply
    from datetime import datetime, timezone

    preview = body.body_full[:300] if body.body_full else None
    reply = Reply(
        sequence_id=body.sequence_id,
        campaign_id=campaign_id,
        lead_name=body.lead_name,
        company=body.company,
        channel=body.channel,
        from_email=body.from_email,
        subject=body.subject,
        body_preview=preview,
        body_full=body.body_full,
        intent=body.intent,
        sentiment_score=body.sentiment_score,
        next_action=body.next_action,
        is_manual=True,
        received_at=datetime.now(timezone.utc),
    )
    db.add(reply)

    # Auto-pause/stop sequence based on intent
    if body.intent in ("UNSUBSCRIBE", "NOT_FIT"):
        from sqlalchemy import update as sa_update
        from app.models.sequence import Sequence as Seq
        await db.execute(
            sa_update(Seq)
            .where(Seq.id == body.sequence_id)
            .values(status="stopped")
        )
    elif body.intent == "OUT_OF_OFFICE":
        pass  # keep sequence running

    await db.commit()
    await db.refresh(reply)
    return reply


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_campaign_or_404(db: AsyncSession, campaign_id: uuid.UUID, user_id: uuid.UUID) -> Campaign:
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


async def _campaign_out(db: AsyncSession, campaign: Campaign) -> CampaignOut:
    from app.models.campaign_file import CampaignFile

    # Re-fetch fresh to avoid MissingGreenlet after multiple commits
    fresh = await db.execute(select(Campaign).where(Campaign.id == campaign.id))
    campaign = fresh.scalar_one()

    leads_count_r = await db.execute(
        select(func.count()).where(Lead.campaign_id == campaign.id)
    )
    seq_count_r = await db.execute(
        select(func.count()).where(Sequence.campaign_id == campaign.id)
    )
    files_r = await db.execute(
        select(CampaignFile).where(CampaignFile.campaign_id == campaign.id)
    )
    files = files_r.scalars().all()

    return CampaignOut(
        id=campaign.id,
        target_url=campaign.target_url,
        leads_requested=campaign.leads_requested,
        batch_size=campaign.batch_size,
        status=campaign.status,
        slug=campaign.slug,
        credits_charged=campaign.credits_charged,
        error_message=campaign.error_message,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at,
        completed_at=campaign.completed_at,
        files=files,
        leads_count=leads_count_r.scalar() or 0,
        sequences_count=seq_count_r.scalar() or 0,
        enrichment_stats=campaign.enrichment_stats,
        icp_profiles=campaign.icp_profiles,
    )


async def _schedule_steps(db: AsyncSession, sequence: Sequence, user_id: uuid.UUID) -> None:
    """Stamp scheduled_for on each step based on its day offset from now."""
    from datetime import timedelta

    result = await db.execute(
        select(SequenceStep).where(SequenceStep.sequence_id == sequence.id)
    )
    steps = result.scalars().all()
    base = datetime.now(timezone.utc)
    for step in steps:
        if step.status == "pending":
            step.scheduled_for = base + timedelta(days=step.day - 1)
            step.status = "scheduled"


async def _replace_sender_placeholder(db: AsyncSession, campaign_id: uuid.UUID, sender_name: str) -> None:
    from sqlalchemy import update as sa_update

    await db.execute(
        sa_update(SequenceStep)
        .where(
            SequenceStep.lead_id.in_(
                select(Lead.id).where(Lead.campaign_id == campaign_id)
            )
        )
        .values(
            content=func.replace(SequenceStep.content, "[Seller Name]", sender_name),
            subject=func.replace(SequenceStep.subject, "[Seller Name]", sender_name),
        )
        .execution_options(synchronize_session=False)
    )
    await db.commit()
