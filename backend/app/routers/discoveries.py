from __future__ import annotations

import asyncio
import json
import math
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import CurrentUser
from app.models.campaign import Campaign
from app.models.credit_transaction import CreditTransaction
from app.models.discovery import (
    BulkLaunchItem,
    BulkLaunchJob,
    DiscoveryRun,
    ProspectAccount,
    ResearchEvidence,
)
from app.models.user import User
from app.schemas.discovery import (
    AccountUpdate,
    BulkLaunchOut,
    BulkLaunchRequest,
    BulkSelectRequest,
    DiscoveryCreate,
    DiscoveryListOut,
    DiscoveryRunOut,
    PaginatedAccountsOut,
    ProspectAccountOut,
)
from app.services.discovery_safety import UnsafeDiscoveryInput, validate_discovery_criteria

settings = get_settings()
router = APIRouter(prefix="/discoveries", tags=["discoveries"])
ACTIVE_STATUSES = ("queued", "planning", "searching", "scoring")


async def _owned_run(db: AsyncSession, run_id: uuid.UUID, user_id: uuid.UUID) -> DiscoveryRun:
    result = await db.execute(select(DiscoveryRun).where(
        DiscoveryRun.id == run_id, DiscoveryRun.user_id == user_id
    ))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Discovery run not found")
    return run


@router.post("", response_model=DiscoveryRunOut, status_code=status.HTTP_201_CREATED)
async def create_discovery(
    body: DiscoveryCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if not settings.account_discovery_enabled:
        raise HTTPException(status_code=503, detail="Account Discovery is not enabled")
    if body.requested_accounts > settings.discovery_max_accounts:
        raise HTTPException(status_code=400, detail=f"Maximum {settings.discovery_max_accounts} accounts per run")
    criteria = body.model_dump(exclude={"name", "requested_accounts"})
    try:
        validate_discovery_criteria(criteria)
    except UnsafeDiscoveryInput as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    active = await db.scalar(select(func.count()).select_from(DiscoveryRun).where(
        DiscoveryRun.user_id == current_user.id,
        DiscoveryRun.status.in_(ACTIVE_STATUSES),
    ))
    if (active or 0) >= settings.discovery_active_runs_per_user:
        raise HTTPException(status_code=429, detail="Maximum active discovery runs reached")
    run = DiscoveryRun(
        user_id=current_user.id,
        name=body.name,
        criteria=criteria,
        requested_accounts=body.requested_accounts,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    from app.tasks.discovery_tasks import run_discovery_task
    from app.tasks.worker_app import ensure_worker_open
    try:
        await ensure_worker_open()
        await run_discovery_task.defer_async(run_id=str(run.id))
    except Exception as exc:
        run.status = "failed"
        run.error_message = f"Could not queue discovery: {exc}"
        await db.commit()
        raise HTTPException(status_code=503, detail=run.error_message) from exc
    return run


@router.get("", response_model=list[DiscoveryListOut])
async def list_discoveries(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    result = await db.execute(select(DiscoveryRun).where(
        DiscoveryRun.user_id == current_user.id
    ).order_by(DiscoveryRun.created_at.desc()).offset((page - 1) * per_page).limit(per_page))
    return result.scalars().all()


@router.get("/{run_id}", response_model=DiscoveryRunOut)
async def get_discovery(run_id: uuid.UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    return await _owned_run(db, run_id, current_user.id)


@router.post("/{run_id}/cancel", response_model=DiscoveryRunOut)
async def cancel_discovery(run_id: uuid.UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    run = await _owned_run(db, run_id, current_user.id)
    if run.status not in ACTIVE_STATUSES:
        raise HTTPException(status_code=400, detail="Only active discoveries can be cancelled")
    run.status = "cancelled"
    run.completion_reason = "cancelled"
    run.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(run)
    return run


@router.get("/{run_id}/accounts", response_model=PaginatedAccountsOut)
async def list_accounts(
    run_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    min_score: int = Query(50, ge=0, le=100),
    signal_type: str | None = None,
    account_status: str | None = Query(None, alias="status"),
):
    await _owned_run(db, run_id, current_user.id)
    conditions = [
        ProspectAccount.discovery_run_id == run_id,
        ProspectAccount.composite_score >= min_score,
    ]
    if account_status:
        conditions.append(ProspectAccount.status == account_status)
    query = select(ProspectAccount).where(*conditions)
    count_query = select(func.count()).select_from(ProspectAccount).where(*conditions)
    if signal_type:
        query = query.join(ResearchEvidence).where(ResearchEvidence.signal_type == signal_type).distinct()
        count_query = select(func.count(func.distinct(ProspectAccount.id))).select_from(ProspectAccount).join(
            ResearchEvidence
        ).where(*conditions, ResearchEvidence.signal_type == signal_type)
    total = await db.scalar(count_query) or 0
    result = await db.execute(query.options(selectinload(ProspectAccount.evidence)).order_by(
        ProspectAccount.composite_score.desc(), ProspectAccount.name
    ).offset((page - 1) * per_page).limit(per_page))
    items = result.scalars().unique().all()
    return PaginatedAccountsOut(
        items=[ProspectAccountOut.model_validate(item) for item in items],
        page=page,
        per_page=per_page,
        total=total,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.get("/{run_id}/accounts/{account_id}", response_model=ProspectAccountOut)
async def get_account(
    run_id: uuid.UUID, account_id: uuid.UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
):
    await _owned_run(db, run_id, current_user.id)
    result = await db.execute(select(ProspectAccount).where(
        ProspectAccount.id == account_id, ProspectAccount.discovery_run_id == run_id
    ).options(selectinload(ProspectAccount.evidence)))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.patch("/{run_id}/accounts/{account_id}", response_model=ProspectAccountOut)
async def update_account(
    run_id: uuid.UUID,
    account_id: uuid.UUID,
    body: AccountUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _owned_run(db, run_id, current_user.id)
    result = await db.execute(select(ProspectAccount).where(
        ProspectAccount.id == account_id, ProspectAccount.discovery_run_id == run_id
    ).options(selectinload(ProspectAccount.evidence)))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.status == "campaign_created":
        raise HTTPException(status_code=409, detail="Account already has a campaign")
    account.status = body.status
    account.selected_at = datetime.now(timezone.utc) if body.status == "selected" else None
    await db.commit()
    await db.refresh(account)
    return account


@router.post("/{run_id}/accounts/bulk-select")
async def bulk_select(
    run_id: uuid.UUID,
    body: BulkSelectRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _owned_run(db, run_id, current_user.id)
    query = select(ProspectAccount).where(
        ProspectAccount.discovery_run_id == run_id,
        ProspectAccount.status != "campaign_created",
    )
    if body.select_all_filtered:
        query = query.where(ProspectAccount.composite_score >= body.min_score)
        if body.signal_type:
            query = query.join(ResearchEvidence).where(ResearchEvidence.signal_type == body.signal_type).distinct()
    else:
        query = query.where(ProspectAccount.id.in_(body.account_ids))
    accounts = (await db.execute(query)).scalars().unique().all()
    now = datetime.now(timezone.utc)
    for account in accounts:
        account.status = body.status
        account.selected_at = now if body.status == "selected" else None
    await db.commit()
    return {"updated": len(accounts), "status": body.status}


def _slug(domain: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", domain.lower()).strip("_")[:50]


@router.post("/{run_id}/launch-campaigns", response_model=BulkLaunchOut, status_code=202)
async def launch_campaigns(
    run_id: uuid.UUID,
    body: BulkLaunchRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    run = await _owned_run(db, run_id, current_user.id)
    ids = list(dict.fromkeys(body.account_ids))
    if len(ids) > settings.discovery_max_accounts:
        raise HTTPException(status_code=400, detail="Too many accounts")
    if len(ids) > 50 and not body.confirm_large_launch:
        raise HTTPException(status_code=400, detail="Set confirm_large_launch=true for more than 50 campaigns")
    result = await db.execute(select(ProspectAccount).where(
        ProspectAccount.discovery_run_id == run.id,
        ProspectAccount.id.in_(ids),
    ).with_for_update())
    accounts = result.scalars().all()
    if len(accounts) != len(ids):
        raise HTTPException(status_code=404, detail="One or more accounts were not found")
    invalid = [a.name for a in accounts if a.status not in ("selected", "campaign_created")]
    if invalid:
        raise HTTPException(status_code=409, detail=f"Select accounts before launch: {', '.join(invalid[:5])}")
    existing = (await db.execute(select(Campaign).where(
        Campaign.discovery_account_id.in_(ids)
    ))).scalars().all()
    existing_by_account = {c.discovery_account_id: c for c in existing}
    pending = [account for account in accounts if account.id not in existing_by_account]
    per_campaign = math.ceil(body.leads_per_account / 10) * settings.credits_per_pipeline
    credits = per_campaign * len(pending)
    user = (await db.execute(select(User).where(User.id == current_user.id).with_for_update())).scalar_one()
    if user.credit_balance < credits:
        raise HTTPException(status_code=402, detail=f"Insufficient credits. Have {user.credit_balance}, need {credits}.")
    user.credit_balance -= credits
    job = BulkLaunchJob(
        discovery_run_id=run.id,
        user_id=user.id,
        leads_per_account=body.leads_per_account,
        batch_size=body.batch_size,
        total_accounts=len(pending),
        credits_reserved=credits,
        status="queued",
    )
    db.add(job)
    await db.flush()
    for account in pending:
        campaign = Campaign(
            user_id=user.id,
            discovery_account_id=account.id,
            target_url=account.website_url,
            leads_requested=body.leads_per_account,
            batch_size=body.batch_size,
            slug=_slug(account.normalized_domain),
            status="queued",
            credits_charged=per_campaign,
        )
        db.add(campaign)
        await db.flush()
        db.add(CreditTransaction(
            user_id=user.id,
            campaign_id=campaign.id,
            amount=-per_campaign,
            type="pipeline_run",
            description=f"Discovery campaign for {account.normalized_domain}",
        ))
        db.add(BulkLaunchItem(
            bulk_launch_job_id=job.id,
            prospect_account_id=account.id,
            campaign_id=campaign.id,
            credits_charged=per_campaign,
        ))
        account.status = "campaign_created"
    await db.commit()
    if pending:
        from app.tasks.discovery_tasks import dispatch_bulk_launch
        from app.tasks.worker_app import ensure_worker_open
        try:
            await ensure_worker_open()
            await dispatch_bulk_launch.defer_async(job_id=str(job.id))
        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)
            user = (await db.execute(select(User).where(User.id == current_user.id).with_for_update())).scalar_one()
            user.credit_balance += credits
            for campaign in (await db.execute(select(Campaign).where(
                Campaign.discovery_account_id.in_([a.id for a in pending])
            ))).scalars():
                db.add(CreditTransaction(
                    user_id=user.id,
                    campaign_id=campaign.id,
                    amount=campaign.credits_charged or 0,
                    type="pipeline_refund",
                    description="Refund: bulk launch could not be queued",
                ))
                campaign.status = "failed"
            await db.commit()
            raise HTTPException(status_code=503, detail="Could not queue campaign launch; credits refunded") from exc
    return BulkLaunchOut(
        job_id=job.id,
        status=job.status,
        total_accounts=len(pending),
        credits_reserved=credits,
        existing_campaign_ids=[campaign.id for campaign in existing],
    )


@router.delete("/{run_id}", status_code=204)
async def delete_discovery(run_id: uuid.UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    run = await _owned_run(db, run_id, current_user.id)
    campaign_count = await db.scalar(select(func.count()).select_from(Campaign).join(
        ProspectAccount, Campaign.discovery_account_id == ProspectAccount.id
    ).where(ProspectAccount.discovery_run_id == run.id))
    if campaign_count:
        raise HTTPException(status_code=409, detail="Discovery runs with campaigns cannot be deleted")
    await db.delete(run)
    await db.commit()


@router.get("/{run_id}/stream")
async def stream_discovery(
    run_id: uuid.UUID,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    from app.routers.stream import _get_user_from_token
    user = await _get_user_from_token(token, db)
    await _owned_run(db, run_id, user.id)

    async def events():
        import asyncpg

        url = settings.database_url
        dsn = url.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]
        ssl = "require" if ("ssl=require" in url or "sslmode=require" in url) else None
        conn = await asyncpg.connect(dsn=dsn, ssl=ssl)
        try:
            yield f"data: {json.dumps({'type': 'connected', 'run_id': str(run_id)})}\n\n"
            channel = f"discovery:{run_id}:progress"
            last_event_id = 0
            idle_polls = 0
            while True:
                rows = await conn.fetch(
                    "SELECT id, payload FROM campaign_events WHERE channel = $1 AND id > $2 ORDER BY id LIMIT 100",
                    channel,
                    last_event_id,
                )
                if rows:
                    idle_polls = 0
                    done = False
                    for row in rows:
                        last_event_id = row["id"]
                        payload = dict(row["payload"])
                        yield f"data: {json.dumps(payload)}\n\n"
                        if payload.get("status") in ("review", "completed", "failed", "cancelled"):
                            done = True
                            break
                    if done:
                        break
                else:
                    idle_polls += 1
                    if idle_polls >= 5:
                        yield ": heartbeat\n\n"
                        idle_polls = 0
                await asyncio.sleep(1.0)
        finally:
            await conn.close()

    return StreamingResponse(events(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no",
    })
