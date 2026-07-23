from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DiscoveryRun(Base):
    __tablename__ = "discovery_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    criteria: Mapped[dict] = mapped_column(JSONB, nullable=False)
    requested_accounts: Mapped[int] = mapped_column(Integer, nullable=False)
    discovered_accounts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_shards: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_shards: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="queued", nullable=False, index=True)
    completion_reason: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    celery_task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    agent_session_ids: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    provider_usage: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    query_plan_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    raw_output_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="discovery_runs")
    shards: Mapped[list["DiscoveryShard"]] = relationship(
        "DiscoveryShard", back_populates="run", cascade="all, delete-orphan"
    )
    accounts: Mapped[list["ProspectAccount"]] = relationship(
        "ProspectAccount", back_populates="run", cascade="all, delete-orphan"
    )


class DiscoveryShard(Base):
    __tablename__ = "discovery_shards"
    __table_args__ = (UniqueConstraint("discovery_run_id", "batch_index"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    discovery_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("discovery_runs.id", ondelete="CASCADE"), index=True
    )
    batch_index: Mapped[int] = mapped_column(Integer, nullable=False)
    partition_criteria: Mapped[dict] = mapped_column(JSONB, nullable=False)
    target_accounts: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    query_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    raw_candidate_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unique_candidate_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    run: Mapped["DiscoveryRun"] = relationship("DiscoveryRun", back_populates="shards")
    queries: Mapped[list["DiscoveryQuery"]] = relationship(
        "DiscoveryQuery", back_populates="shard", cascade="all, delete-orphan"
    )


class DiscoveryQuery(Base):
    __tablename__ = "discovery_queries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    discovery_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("discovery_runs.id", ondelete="CASCADE"), index=True
    )
    discovery_shard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("discovery_shards.id", ondelete="CASCADE"), index=True
    )
    family: Mapped[str] = mapped_column(String(64), nullable=False)
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="planned", nullable=False)
    result_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    shard: Mapped["DiscoveryShard"] = relationship("DiscoveryShard", back_populates="queries")


class ProspectAccount(Base):
    __tablename__ = "prospect_accounts"
    __table_args__ = (UniqueConstraint("discovery_run_id", "normalized_domain"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    discovery_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("discovery_runs.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    website_url: Mapped[str] = mapped_column(String, nullable=False)
    industry: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    employee_range: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    icp_score: Mapped[int] = mapped_column(Integer, nullable=False)
    signal_score: Mapped[int] = mapped_column(Integer, nullable=False)
    recency_score: Mapped[int] = mapped_column(Integer, nullable=False)
    source_quality_score: Mapped[int] = mapped_column(Integer, nullable=False)
    composite_score: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    score_rationale: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="candidate", nullable=False, index=True)
    selected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    run: Mapped["DiscoveryRun"] = relationship("DiscoveryRun", back_populates="accounts")
    evidence: Mapped[list["ResearchEvidence"]] = relationship(
        "ResearchEvidence", back_populates="account", cascade="all, delete-orphan"
    )
    campaign: Mapped[Optional["Campaign"]] = relationship(
        "Campaign", back_populates="discovery_account", uselist=False
    )


class ResearchEvidence(Base):
    __tablename__ = "research_evidence"
    __table_args__ = (
        CheckConstraint(
            "prospect_account_id IS NOT NULL OR campaign_id IS NOT NULL OR lead_id IS NOT NULL",
            name="ck_research_evidence_has_subject",
        ),
        UniqueConstraint("prospect_account_id", "content_hash"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    discovery_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("discovery_runs.id", ondelete="CASCADE"), nullable=True, index=True
    )
    prospect_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospect_accounts.id", ondelete="CASCADE"), nullable=True, index=True
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=True, index=True
    )
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=True, index=True
    )
    evidence_kind: Mapped[str] = mapped_column(String(64), default="account_signal", nullable=False)
    signal_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)
    source_domain: Mapped[str] = mapped_column(String(255), nullable=False)
    source_title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    publisher: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    excerpt: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_quality_score: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    evidence_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    account: Mapped[Optional["ProspectAccount"]] = relationship(
        "ProspectAccount", back_populates="evidence"
    )


class SequenceEvidenceLink(Base):
    __tablename__ = "sequence_evidence_links"
    __table_args__ = (UniqueConstraint("sequence_id", "evidence_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sequence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sequences.id", ondelete="CASCADE"), index=True
    )
    evidence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("research_evidence.id", ondelete="CASCADE"), index=True
    )


class BulkLaunchJob(Base):
    __tablename__ = "bulk_launch_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    discovery_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("discovery_runs.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(32), default="queued", nullable=False, index=True)
    leads_per_account: Mapped[int] = mapped_column(Integer, nullable=False)
    batch_size: Mapped[int] = mapped_column(Integer, nullable=False)
    total_accounts: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_accounts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    credits_reserved: Mapped[int] = mapped_column(Integer, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list["BulkLaunchItem"]] = relationship(
        "BulkLaunchItem", back_populates="job", cascade="all, delete-orphan"
    )


class BulkLaunchItem(Base):
    __tablename__ = "bulk_launch_items"
    __table_args__ = (UniqueConstraint("bulk_launch_job_id", "prospect_account_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bulk_launch_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bulk_launch_jobs.id", ondelete="CASCADE"), index=True
    )
    prospect_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospect_accounts.id", ondelete="CASCADE"), index=True
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    credits_charged: Mapped[int] = mapped_column(Integer, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job: Mapped["BulkLaunchJob"] = relationship("BulkLaunchJob", back_populates="items")
