from __future__ import annotations

import uuid
from typing import Any

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.models.credit_transaction import CreditTransaction
from app.services import credits as credits_svc

STRIPE_PRODUCT = "amrogen"

# 10-campaign packs → 80 credits (8 credits per campaign)
PLAN_CREDITS: dict[str, int] = {
    "starter": 80,
    "professional": 80,
    "enterprise": 80,
    # Legacy checkout plan ids (mapped to same packs)
    "growth": 80,
    "scale": 80,
}


class StripeNotConfiguredError(Exception):
    pass


def configure_stripe(settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    if not settings.stripe_secret_key:
        raise StripeNotConfiguredError("STRIPE_SECRET_KEY is not configured")
    stripe.api_key = settings.stripe_secret_key


def plan_price_map(settings: Settings | None = None) -> dict[str, tuple[str, int]]:
    """Map checkout plan id → (Stripe price id, credits granted)."""
    settings = settings or get_settings()
    professional_price = settings.stripe_price_professional or settings.stripe_price_growth
    enterprise_price = settings.stripe_price_enterprise or settings.stripe_price_scale
    starter = (settings.stripe_price_starter, PLAN_CREDITS["starter"])
    professional = (professional_price, PLAN_CREDITS["professional"])
    enterprise = (enterprise_price, PLAN_CREDITS["enterprise"])
    return {
        "starter": starter,
        "professional": professional,
        "enterprise": enterprise,
        # Legacy checkout plan ids
        "growth": professional,
        "scale": enterprise,
    }


def credits_for_price_id(price_id: str, settings: Settings | None = None) -> int | None:
    seen: set[str] = set()
    for _plan, (configured_price_id, credits) in plan_price_map(settings).items():
        if not configured_price_id or configured_price_id in seen:
            continue
        seen.add(configured_price_id)
        if configured_price_id == price_id:
            return credits
    return None


def _session_product(session: dict[str, Any]) -> str:
    metadata = session.get("metadata") or {}
    return str(metadata.get("product") or "").lower()


def _is_amrogen_session(session: dict[str, Any]) -> bool:
    product = _session_product(session)
    return product in ("", STRIPE_PRODUCT)


async def _reference_already_processed(db: AsyncSession, reference_id: str) -> bool:
    result = await db.execute(
        select(CreditTransaction.id).where(CreditTransaction.stripe_session_id == reference_id).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def apply_checkout_session(
    db: AsyncSession,
    session: dict[str, Any],
    *,
    settings: Settings | None = None,
) -> dict[str, Any] | None:
    """Credit a user from a completed Stripe Checkout session. Idempotent by session id."""
    settings = settings or get_settings()

    if not _is_amrogen_session(session):
        return None

    session_id = session.get("id")
    if not session_id:
        return None

    if await _reference_already_processed(db, session_id):
        return {"status": "already_processed", "session_id": session_id}

    payment_status = session.get("payment_status")
    status = session.get("status")
    if payment_status not in ("paid", "no_payment_required") and status != "complete":
        return None

    metadata = session.get("metadata") or {}
    user_id_str = session.get("client_reference_id") or metadata.get("user_id")
    credits_str = metadata.get("credits")
    plan = metadata.get("plan", "")

    if not user_id_str:
        return None

    credits_amount = int(credits_str) if credits_str else PLAN_CREDITS.get(str(plan), 0)
    if credits_amount <= 0:
        return None

    user_id = uuid.UUID(str(user_id_str))
    payment_intent = session.get("payment_intent")
    payment_ref = payment_intent if isinstance(payment_intent, str) else None

    tx = await credits_svc.credit(
        db,
        user_id=user_id,
        amount=credits_amount,
        tx_type="purchase",
        description=f"Purchased {credits_amount} credits ({plan or 'pack'})",
        stripe_payment_intent_id=payment_ref,
        stripe_session_id=session_id,
    )
    return {
        "status": "credited",
        "session_id": session_id,
        "credits": credits_amount,
        "transaction_id": str(tx.id),
    }


async def apply_invoice_paid(
    db: AsyncSession,
    invoice: dict[str, Any],
    *,
    settings: Settings | None = None,
) -> dict[str, Any] | None:
    """No-op for one-time packs. Kept for old subscription renewals still in flight."""
    settings = settings or get_settings()

    if invoice.get("billing_reason") != "subscription_cycle":
        return None

    invoice_id = invoice.get("id")
    if not invoice_id or await _reference_already_processed(db, invoice_id):
        return {"status": "already_processed", "invoice_id": invoice_id}

    lines = (invoice.get("lines") or {}).get("data") or []
    price_id = None
    for line in lines:
        price = line.get("price") or {}
        if price.get("id"):
            price_id = price["id"]
            break

    if not price_id:
        return None

    credits_amount = credits_for_price_id(price_id, settings)
    if not credits_amount:
        return None

    metadata = invoice.get("metadata") or {}
    user_id_str = metadata.get("user_id")
    subscription_id = invoice.get("subscription")

    if not user_id_str and subscription_id:
        configure_stripe(settings)
        subscription = stripe.Subscription.retrieve(subscription_id)
        subscription_metadata = subscription.get("metadata") or {}
        user_id_str = subscription_metadata.get("user_id")

    if not user_id_str:
        return None

    user_id = uuid.UUID(str(user_id_str))
    tx = await credits_svc.credit(
        db,
        user_id=user_id,
        amount=credits_amount,
        tx_type="subscription_renewal",
        description=f"Subscription renewal — {credits_amount} credits",
        stripe_payment_intent_id=invoice.get("payment_intent")
        if isinstance(invoice.get("payment_intent"), str)
        else None,
        stripe_session_id=invoice_id,
    )
    return {
        "status": "credited",
        "invoice_id": invoice_id,
        "credits": credits_amount,
        "transaction_id": str(tx.id),
    }
