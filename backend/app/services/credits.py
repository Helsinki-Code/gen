from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.credit_transaction import CreditTransaction
from app.models.user import User


class InsufficientCreditsError(Exception):
    def __init__(self, balance: int, required: int):
        self.balance = balance
        self.required = required
        super().__init__(f"Insufficient credits: have {balance}, need {required}")


async def get_balance(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(select(User.credit_balance).where(User.id == user_id))
    return result.scalar_one_or_none() or 0


async def get_transactions(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 20
) -> list[CreditTransaction]:
    result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == user_id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def deduct(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: int,
    description: str,
    campaign_id: uuid.UUID | None = None,
) -> CreditTransaction:
    result = await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )
    user = result.scalar_one()
    if user.credit_balance < amount:
        raise InsufficientCreditsError(user.credit_balance, amount)

    user.credit_balance -= amount
    tx = CreditTransaction(
        user_id=user_id,
        amount=-amount,
        type="pipeline_run",
        description=description,
        campaign_id=campaign_id,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


async def credit(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: int,
    tx_type: str,
    description: str,
    stripe_payment_intent_id: str | None = None,
    stripe_session_id: str | None = None,
) -> CreditTransaction:
    if stripe_session_id:
        existing = await db.execute(
            select(CreditTransaction.id)
            .where(CreditTransaction.stripe_session_id == stripe_session_id)
            .limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            result = await db.execute(
                select(CreditTransaction)
                .where(CreditTransaction.stripe_session_id == stripe_session_id)
                .limit(1)
            )
            return result.scalar_one()

    result = await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )
    user = result.scalar_one()
    user.credit_balance += amount

    tx = CreditTransaction(
        user_id=user_id,
        amount=amount,
        type=tx_type,
        description=description,
        stripe_payment_intent_id=stripe_payment_intent_id,
        stripe_session_id=stripe_session_id,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx
