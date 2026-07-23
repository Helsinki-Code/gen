from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, HttpUrl, field_validator


class CampaignCreate(BaseModel):
    target_url: str
    leads_requested: int = 25
    batch_size: int = 5

    @field_validator("leads_requested")
    @classmethod
    def clamp_leads(cls, v: int) -> int:
        if v < 1:
            raise ValueError("leads_requested must be at least 1")
        if v > 100:
            raise ValueError("leads_requested cannot exceed 100")
        return v

    @field_validator("batch_size")
    @classmethod
    def clamp_batch(cls, v: int) -> int:
        if v < 1 or v > 10:
            raise ValueError("batch_size must be between 1 and 10")
        return v


class CampaignFileOut(BaseModel):
    file_type: str
    gcs_path: str
    file_size_bytes: int | None

    model_config = {"from_attributes": True}


class CampaignOut(BaseModel):
    id: uuid.UUID
    target_url: str
    leads_requested: int
    batch_size: int
    status: str
    slug: str
    credits_charged: int | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    files: list[CampaignFileOut] = []
    leads_count: int = 0
    sequences_count: int = 0
    enrichment_stats: dict | None = None
    icp_profiles: list | None = None

    model_config = {"from_attributes": True}


class CampaignListOut(BaseModel):
    id: uuid.UUID
    target_url: str
    leads_requested: int
    status: str
    credits_charged: int | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}
