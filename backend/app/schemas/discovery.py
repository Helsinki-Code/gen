from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


SignalType = Literal[
    "hiring",
    "funding",
    "expansion",
    "leadership_change",
    "product_launch",
    "partnership",
    "competitor_usage",
    "public_report",
]


class DiscoveryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    seller_description: str = Field(min_length=10, max_length=4000)
    icp_description: str = Field(min_length=10, max_length=4000)
    industries: list[str] = Field(default_factory=list, max_length=25)
    geographies: list[str] = Field(default_factory=list, max_length=25)
    employee_min: int | None = Field(default=None, ge=1, le=1_000_000)
    employee_max: int | None = Field(default=None, ge=1, le=1_000_000)
    requested_accounts: Literal[25, 50, 100, 250, 500, 1000] = 50
    signals: list[SignalType] = Field(default_factory=lambda: ["hiring", "funding"])
    competitors: list[str] = Field(default_factory=list, max_length=25)
    excluded_industries: list[str] = Field(default_factory=list, max_length=25)
    excluded_domains: list[str] = Field(default_factory=list, max_length=100)
    excluded_keywords: list[str] = Field(default_factory=list, max_length=100)

    @field_validator(
        "industries",
        "geographies",
        "competitors",
        "excluded_industries",
        "excluded_domains",
        "excluded_keywords",
    )
    @classmethod
    def clean_lists(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for value in values:
            item = value.strip()
            if item and item.lower() not in seen:
                cleaned.append(item[:255])
                seen.add(item.lower())
        return cleaned

    @model_validator(mode="after")
    def validate_range_and_signals(self):
        if self.employee_min and self.employee_max and self.employee_min > self.employee_max:
            raise ValueError("employee_min cannot exceed employee_max")
        if not self.signals:
            raise ValueError("Select at least one buying signal")
        return self


class EvidenceOut(BaseModel):
    id: uuid.UUID
    signal_type: str
    source_url: str
    source_domain: str
    source_title: str | None
    publisher: str | None
    source_type: str
    summary: str
    excerpt: str | None
    published_at: datetime | None
    observed_at: datetime
    source_quality_score: int
    confidence_score: int

    model_config = {"from_attributes": True}


class ProspectAccountOut(BaseModel):
    id: uuid.UUID
    discovery_run_id: uuid.UUID
    name: str
    normalized_domain: str
    website_url: str
    industry: str | None
    location: str | None
    employee_range: str | None
    icp_score: int
    signal_score: int
    recency_score: int
    source_quality_score: int
    composite_score: int
    score_rationale: str
    status: str
    selected_at: datetime | None
    evidence: list[EvidenceOut] = []

    model_config = {"from_attributes": True}


class DiscoveryRunOut(BaseModel):
    id: uuid.UUID
    name: str
    criteria: dict
    requested_accounts: int
    discovered_accounts: int
    total_shards: int
    completed_shards: int
    status: str
    completion_reason: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class DiscoveryListOut(BaseModel):
    id: uuid.UUID
    name: str
    requested_accounts: int
    discovered_accounts: int
    total_shards: int
    completed_shards: int
    status: str
    completion_reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AccountUpdate(BaseModel):
    status: Literal["candidate", "selected", "rejected"]


class BulkSelectRequest(BaseModel):
    account_ids: list[uuid.UUID] = Field(default_factory=list, max_length=1000)
    status: Literal["selected", "rejected", "candidate"] = "selected"
    select_all_filtered: bool = False
    min_score: int = Field(default=50, ge=0, le=100)
    signal_type: SignalType | None = None


class BulkLaunchRequest(BaseModel):
    account_ids: list[uuid.UUID] = Field(min_length=1, max_length=1000)
    leads_per_account: int = Field(default=10, ge=1, le=100)
    batch_size: int = Field(default=5, ge=1, le=10)
    confirm_large_launch: bool = False


class BulkLaunchOut(BaseModel):
    job_id: uuid.UUID
    status: str
    total_accounts: int
    credits_reserved: int
    existing_campaign_ids: list[uuid.UUID] = []


class PaginatedAccountsOut(BaseModel):
    items: list[ProspectAccountOut]
    page: int
    per_page: int
    total: int
    pages: int
