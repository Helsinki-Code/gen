from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

INTENT_OPTIONS = Literal[
    "HOT", "WARM", "NEUTRAL", "OBJECTION", "NOT_FIT", "OUT_OF_OFFICE", "UNSUBSCRIBE"
]

NEXT_ACTION_OPTIONS = Literal[
    "book_meeting", "send_case_study", "send_pricing", "address_objection",
    "continue_sequence", "pause_30_days", "pause_sequence", "stop_sequence",
    "wait_for_ooo", "escalate_to_human",
]


class ReplyCreate(BaseModel):
    sequence_id: uuid.UUID
    lead_name: str
    company: str | None = None
    channel: Literal["email", "sms"] = "email"
    from_email: str | None = None
    subject: str | None = None
    body_full: str
    intent: INTENT_OPTIONS
    sentiment_score: int | None = None
    next_action: NEXT_ACTION_OPTIONS | None = None


class ReplyOut(BaseModel):
    id: uuid.UUID
    sequence_id: uuid.UUID
    campaign_id: uuid.UUID | None
    lead_name: str | None
    company: str | None
    channel: str | None
    from_email: str | None
    subject: str | None
    body_preview: str | None
    intent: str | None
    sentiment_score: int | None
    next_action: str | None
    is_manual: bool
    created_at: datetime

    model_config = {"from_attributes": True}
