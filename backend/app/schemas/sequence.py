from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class SequenceStepOut(BaseModel):
    id: uuid.UUID
    step_number: int
    day: int
    channel: str
    type: str
    subject: str | None
    content: str
    status: str
    scheduled_for: datetime | None
    sent_at: datetime | None

    model_config = {"from_attributes": True}


class LeadInSequence(BaseModel):
    id: uuid.UUID
    name: str | None
    title: str | None
    company: str | None
    email: str | None
    email_type: str | None
    email_confidence: str | None
    linkedin_url: str | None
    icp_fit_score: str | None
    icp_fit: str | None
    best_outreach_angle: str | None
    company_website: str | None
    company_size: str | None
    company_industry: str | None

    model_config = {"from_attributes": True}


class SequenceOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    lead: LeadInSequence | None = None
    status: str
    channels: list[str] | None
    approved_at: datetime | None
    steps: list[SequenceStepOut] = []

    model_config = {"from_attributes": True}


class SequenceUpdate(BaseModel):
    status: Literal["approved", "rejected"] | None = None


class SequenceStepUpdate(BaseModel):
    content: str | None = None
    subject: str | None = None
    status: Literal["pending", "skipped"] | None = None
