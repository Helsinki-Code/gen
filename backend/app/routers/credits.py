from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import CurrentUser
from app.schemas.credits import (
    ConfirmSessionRequest,
    CreditsBalance,
    CreditTransaction,
    PurchaseRequest,
)
from app.services import credits as svc
from app.services import stripe_billing as stripe_svc

settings = get_settings()
router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("/balance", response_model=CreditsBalance)
async def get_balance(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    balance = await svc.get_balance(db, current_user.id)
    transactions = await svc.get_transactions(db, current_user.id)
    return CreditsBalance(
        balance=balance,
        transactions=[CreditTransaction.model_validate(t) for t in transactions],
    )


@router.post("/purchase")
async def purchase_credits(
    body: PurchaseRequest,
    current_user: CurrentUser,
):
    plan_prices = stripe_svc.plan_price_map(settings)
    if body.plan not in plan_prices:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {body.plan}")

    price_id, credits = plan_prices[body.plan]
    if not price_id:
        raise HTTPException(status_code=400, detail="Plan price not configured")

    try:
        stripe_svc.configure_stripe(settings)
    except stripe_svc.StripeNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    import stripe

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="payment",
        success_url=(
            f"{settings.frontend_url}/settings/credits?success=1"
            "&session_id={CHECKOUT_SESSION_ID}"
        ),
        cancel_url=f"{settings.frontend_url}/settings/credits?canceled=1",
        metadata={
            "product": stripe_svc.STRIPE_PRODUCT,
            "user_id": str(current_user.id),
            "plan": body.plan,
            "credits": str(credits),
        },
        client_reference_id=str(current_user.id),
    )
    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/confirm-session")
async def confirm_checkout_session(
    body: ConfirmSessionRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Dev-friendly fallback when Stripe webhooks cannot reach localhost (Academy pattern)."""
    try:
        stripe_svc.configure_stripe(settings)
    except stripe_svc.StripeNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    import stripe

    session = stripe.checkout.Session.retrieve(body.session_id)
    session_dict = dict(session)
    metadata = session_dict.get("metadata") or {}
    session_user_id = session_dict.get("client_reference_id") or metadata.get("user_id")

    if str(session_user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Session does not belong to this user")

    result = await stripe_svc.apply_checkout_session(db, session_dict)
    if result is None:
        raise HTTPException(status_code=400, detail="Checkout session is not eligible for crediting")

    balance = await svc.get_balance(db, current_user.id)
    return {**result, "balance": balance}
