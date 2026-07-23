from __future__ import annotations

import json

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.services import stripe_billing as stripe_svc

settings = get_settings()
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _parse_stripe_event(payload: bytes, sig_header: str) -> dict:
    if settings.environment == "development" and not settings.stripe_webhook_secret:
        return json.loads(payload)

    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="STRIPE_WEBHOOK_SECRET is not configured")

    try:
        return stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid Stripe payload") from exc


@router.post("/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    event = _parse_stripe_event(payload, sig_header)

    event_type = event.get("type", "")
    data_object = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        await stripe_svc.apply_checkout_session(db, data_object)
    elif event_type == "invoice.paid":
        await stripe_svc.apply_invoice_paid(db, data_object)

    return {"received": True}


@router.post("/anthropic")
async def anthropic_webhook(request: Request):
    """Handle Anthropic session lifecycle webhooks (session.status_idled etc.)."""
    import hmac
    import hashlib

    payload = await request.body()
    sig_header = request.headers.get("anthropic-signature", "")

    if settings.anthropic_webhook_secret and sig_header:
        expected = "sha256=" + hmac.new(
            settings.anthropic_webhook_secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig_header, expected):
            raise HTTPException(status_code=400, detail="Invalid Anthropic webhook signature")

    try:
        event = json.loads(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    event_type = event.get("type", "")

    if event_type == "session.status_idled":
        session_id = event.get("session_id") or event.get("data", {}).get("session_id")
        if session_id:
            import asyncpg
            url = settings.database_url
            dsn = url.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]
            ssl = "require" if ("ssl=require" in url or "sslmode=require" in url) else None
            conn = await asyncpg.connect(dsn=dsn, ssl=ssl)
            try:
                await conn.execute(
                    "INSERT INTO campaign_events (channel, payload) VALUES ($1, $2::jsonb)",
                    f"anthropic:session:{session_id}",
                    json.dumps({"type": "session_complete", "session_id": session_id}),
                )
            finally:
                await conn.close()

    return {"received": True}
