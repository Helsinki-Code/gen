from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class CreditTransaction(BaseModel):
    id: uuid.UUID
    amount: int
    type: str
    description: str | None
    campaign_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CreditsBalance(BaseModel):
    balance: int
    transactions: list[CreditTransaction]


class PurchaseRequest(BaseModel):
    plan: str  # starter | professional | enterprise (growth|scale accepted as aliases)


class ConfirmSessionRequest(BaseModel):
    session_id: str
