from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import APIRouter, Depends, Query

from app.config import get_settings
from app.database import get_db
from app.models.api_key import ApiKey
from app.models.campaign import Campaign
from app.models.credit_transaction import CreditTransaction
from app.models.lead import Lead
from app.models.podcast_episode import PodcastEpisode
from app.models.sequence import Sequence
from app.models.user import User
from app.services.admin_access import AdminUser

router = APIRouter(prefix="/admin", tags=["admin"])


async def _count(db: AsyncSession, model: type) -> int:
    result = await db.execute(select(func.count()).select_from(model))
    return int(result.scalar_one() or 0)


async def _sum(db: AsyncSession, value) -> int:
    result = await db.execute(select(func.coalesce(func.sum(value), 0)))
    return int(result.scalar_one() or 0)


async def _group_counts(db: AsyncSession, model: type, field) -> dict[str, int]:
    result = await db.execute(select(field, func.count()).select_from(model).group_by(field))
    return {str(key): int(value) for key, value in result.all()}


@router.get("/overview")
async def admin_overview(
    _admin_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    campaign_statuses = await _group_counts(db, Campaign, Campaign.status)
    sequence_statuses = await _group_counts(db, Sequence, Sequence.status)
    podcast_statuses = await _group_counts(db, PodcastEpisode, PodcastEpisode.status)

    recent_campaigns_result = await db.execute(
        select(Campaign, User.email)
        .join(User, Campaign.user_id == User.id)
        .order_by(desc(Campaign.created_at))
        .limit(8)
    )
    recent_campaigns = [
        {
            "id": str(campaign.id),
            "user_email": email,
            "target_url": campaign.target_url,
            "leads_requested": campaign.leads_requested,
            "status": campaign.status,
            "credits_charged": campaign.credits_charged,
            "created_at": campaign.created_at,
            "completed_at": campaign.completed_at,
        }
        for campaign, email in recent_campaigns_result.all()
    ]

    recent_episodes_result = await db.execute(
        select(PodcastEpisode, User.email)
        .join(User, PodcastEpisode.user_id == User.id)
        .order_by(desc(PodcastEpisode.created_at))
        .limit(8)
    )
    recent_episodes = [
        {
            "id": str(episode.id),
            "user_email": email,
            "title": episode.title,
            "status": episode.status,
            "source_type": episode.source_type,
            "duration_minutes": episode.duration_minutes,
            "created_at": episode.created_at,
            "published_at": episode.published_at,
        }
        for episode, email in recent_episodes_result.all()
    ]

    return {
        "metrics": {
            "users": await _count(db, User),
            "campaigns": await _count(db, Campaign),
            "leads": await _count(db, Lead),
            "sequences": await _count(db, Sequence),
            "podcast_episodes": await _count(db, PodcastEpisode),
            "credit_balance": await _sum(db, User.credit_balance),
            "credits_transacted": await _sum(db, CreditTransaction.amount),
        },
        "campaign_statuses": campaign_statuses,
        "sequence_statuses": sequence_statuses,
        "podcast_statuses": podcast_statuses,
        "recent_campaigns": recent_campaigns,
        "recent_episodes": recent_episodes,
    }


@router.get("/users")
async def admin_users(
    _admin_user: AdminUser,
    db: AsyncSession = Depends(get_db),
    q: str = Query("", max_length=120),
    limit: int = Query(100, ge=1, le=250),
):
    campaign_stats = (
        select(
            Campaign.user_id.label("user_id"),
            func.count(Campaign.id).label("campaign_count"),
            func.coalesce(func.sum(Campaign.leads_requested), 0).label("leads_requested"),
            func.coalesce(func.sum(func.coalesce(Campaign.credits_charged, 0)), 0).label("credits_charged"),
            func.max(Campaign.created_at).label("last_campaign_at"),
        )
        .group_by(Campaign.user_id)
        .subquery()
    )
    credit_stats = (
        select(
            CreditTransaction.user_id.label("user_id"),
            func.coalesce(
                func.sum(case((CreditTransaction.amount > 0, CreditTransaction.amount), else_=0)), 0
            ).label("credits_purchased"),
            func.coalesce(
                func.sum(case((CreditTransaction.amount < 0, -CreditTransaction.amount), else_=0)), 0
            ).label("credits_spent"),
            func.count(CreditTransaction.id).label("transaction_count"),
            func.max(CreditTransaction.created_at).label("last_transaction_at"),
        )
        .group_by(CreditTransaction.user_id)
        .subquery()
    )
    api_key_stats = (
        select(
            ApiKey.user_id.label("user_id"),
            func.count(ApiKey.id).label("api_key_count"),
            func.coalesce(func.sum(case((ApiKey.is_active.is_(True), 1), else_=0)), 0).label("active_api_key_count"),
            func.max(ApiKey.last_used_at).label("last_api_key_used_at"),
        )
        .group_by(ApiKey.user_id)
        .subquery()
    )
    podcast_stats = (
        select(
            PodcastEpisode.user_id.label("user_id"),
            func.count(PodcastEpisode.id).label("podcast_count"),
            func.max(PodcastEpisode.created_at).label("last_podcast_at"),
        )
        .group_by(PodcastEpisode.user_id)
        .subquery()
    )

    statement = (
        select(
            User,
            campaign_stats.c.campaign_count,
            campaign_stats.c.leads_requested,
            campaign_stats.c.credits_charged,
            campaign_stats.c.last_campaign_at,
            credit_stats.c.credits_purchased,
            credit_stats.c.credits_spent,
            credit_stats.c.transaction_count,
            credit_stats.c.last_transaction_at,
            api_key_stats.c.api_key_count,
            api_key_stats.c.active_api_key_count,
            api_key_stats.c.last_api_key_used_at,
            podcast_stats.c.podcast_count,
            podcast_stats.c.last_podcast_at,
        )
        .outerjoin(campaign_stats, campaign_stats.c.user_id == User.id)
        .outerjoin(credit_stats, credit_stats.c.user_id == User.id)
        .outerjoin(api_key_stats, api_key_stats.c.user_id == User.id)
        .outerjoin(podcast_stats, podcast_stats.c.user_id == User.id)
        .order_by(desc(User.created_at))
        .limit(limit)
    )
    if q.strip():
        search = f"%{q.strip().lower()}%"
        statement = statement.where(func.lower(User.email).like(search))

    rows = (await db.execute(statement)).all()
    users = []
    total_credit_balance = 0
    total_campaigns = 0
    total_credits_purchased = 0
    total_credits_spent = 0
    for row in rows:
        user = row[0]
        campaign_count = int(row.campaign_count or 0)
        credits_purchased = int(row.credits_purchased or 0)
        credits_spent = int(row.credits_spent or 0)
        total_credit_balance += int(user.credit_balance or 0)
        total_campaigns += campaign_count
        total_credits_purchased += credits_purchased
        total_credits_spent += credits_spent
        users.append(
            {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "credit_balance": user.credit_balance,
                "created_at": user.created_at,
                "updated_at": user.updated_at,
                "campaign_count": campaign_count,
                "leads_requested": int(row.leads_requested or 0),
                "credits_charged": int(row.credits_charged or 0),
                "credits_purchased": credits_purchased,
                "credits_spent": credits_spent,
                "transaction_count": int(row.transaction_count or 0),
                "api_key_count": int(row.api_key_count or 0),
                "active_api_key_count": int(row.active_api_key_count or 0),
                "podcast_count": int(row.podcast_count or 0),
                "last_campaign_at": row.last_campaign_at,
                "last_transaction_at": row.last_transaction_at,
                "last_api_key_used_at": row.last_api_key_used_at,
                "last_podcast_at": row.last_podcast_at,
            }
        )

    return {
        "summary": {
            "shown_users": len(users),
            "credit_balance": total_credit_balance,
            "campaigns": total_campaigns,
            "credits_purchased": total_credits_purchased,
            "credits_spent": total_credits_spent,
        },
        "users": users,
    }


@router.get("/revenue")
async def admin_revenue(
    _admin_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    credit_price_cents = settings.credit_price_cents
    since = datetime.now(timezone.utc) - timedelta(days=30)

    credit_totals_result = await db.execute(
        select(
            func.coalesce(func.sum(case((CreditTransaction.amount > 0, CreditTransaction.amount), else_=0)), 0),
            func.coalesce(func.sum(case((CreditTransaction.amount < 0, -CreditTransaction.amount), else_=0)), 0),
            func.count(CreditTransaction.id),
        ).select_from(CreditTransaction)
    )
    credits_purchased, credits_spent, transaction_count = credit_totals_result.one()
    outstanding_credits = await _sum(db, User.credit_balance)

    period_transactions_result = await db.execute(
        select(CreditTransaction, User.email)
        .join(User, CreditTransaction.user_id == User.id)
        .where(CreditTransaction.created_at >= since)
        .order_by(CreditTransaction.created_at)
    )
    flow_by_day: dict[str, dict[str, int]] = {}
    for tx, _email in period_transactions_result.all():
        day = tx.created_at.date().isoformat()
        flow_by_day.setdefault(day, {"date": day, "credits_purchased": 0, "credits_spent": 0, "net_credits": 0})
        if tx.amount > 0:
            flow_by_day[day]["credits_purchased"] += int(tx.amount)
        else:
            flow_by_day[day]["credits_spent"] += abs(int(tx.amount))
        flow_by_day[day]["net_credits"] += int(tx.amount)

    customer_stats = (
        select(
            CreditTransaction.user_id.label("user_id"),
            func.coalesce(
                func.sum(case((CreditTransaction.amount > 0, CreditTransaction.amount), else_=0)), 0
            ).label("credits_purchased"),
            func.coalesce(
                func.sum(case((CreditTransaction.amount < 0, -CreditTransaction.amount), else_=0)), 0
            ).label("credits_spent"),
        )
        .group_by(CreditTransaction.user_id)
        .subquery()
    )
    top_customers_result = await db.execute(
        select(User.email, User.name, User.credit_balance, customer_stats.c.credits_purchased, customer_stats.c.credits_spent)
        .join(customer_stats, customer_stats.c.user_id == User.id)
        .order_by(desc(customer_stats.c.credits_purchased))
        .limit(10)
    )
    top_customers = [
        {
            "email": email,
            "name": name,
            "credit_balance": int(balance or 0),
            "credits_purchased": int(purchased or 0),
            "credits_spent": int(spent or 0),
            "estimated_value_cents": int(purchased or 0) * credit_price_cents,
        }
        for email, name, balance, purchased, spent in top_customers_result.all()
    ]

    recent_transactions_result = await db.execute(
        select(CreditTransaction, User.email)
        .join(User, CreditTransaction.user_id == User.id)
        .order_by(desc(CreditTransaction.created_at))
        .limit(12)
    )
    recent_transactions = [
        {
            "id": str(tx.id),
            "user_email": email,
            "amount": tx.amount,
            "type": tx.type,
            "description": tx.description,
            "stripe_payment_intent_id": tx.stripe_payment_intent_id,
            "created_at": tx.created_at,
            "estimated_value_cents": abs(int(tx.amount)) * credit_price_cents,
        }
        for tx, email in recent_transactions_result.all()
    ]

    return {
        "credit_price_cents": credit_price_cents,
        "metrics": {
            "credits_purchased": int(credits_purchased or 0),
            "credits_spent": int(credits_spent or 0),
            "outstanding_credits": int(outstanding_credits or 0),
            "transaction_count": int(transaction_count or 0),
            "estimated_revenue_cents": int(credits_purchased or 0) * credit_price_cents,
            "estimated_usage_value_cents": int(credits_spent or 0) * credit_price_cents,
            "outstanding_credit_value_cents": int(outstanding_credits or 0) * credit_price_cents,
        },
        "flow_by_day": list(flow_by_day.values()),
        "top_customers": top_customers,
        "recent_transactions": recent_transactions,
    }
