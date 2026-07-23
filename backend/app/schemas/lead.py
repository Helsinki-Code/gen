from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class LeadOut(BaseModel):
    id: uuid.UUID
    row_index: int

    # Core contact
    name: str | None
    title: str | None
    company: str | None
    email: str | None
    email_type: str | None
    email_confidence: str | None
    linkedin_url: str | None
    phone: str | None
    phone_type: str | None
    phone_confidence: str | None
    location: str | None

    # Company intel
    company_website: str | None
    company_size: str | None
    company_industry: str | None
    company_funding_stage: str | None

    # ICP
    icp_fit_score: str | None
    icp_fit: str | None
    icp_fit_justification: str | None

    # Enrichment intelligence
    best_outreach_angle: str | None
    key_responsibilities: str | None
    recent_activity: str | None
    data_sources: list[Any] | None

    model_config = {"from_attributes": True}
