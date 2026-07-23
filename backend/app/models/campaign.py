from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

CampaignStatus = Literal[
    "queued",
    "generating_leads",
    "leads_review",      # HITL gate 1: user approves lead list
    "leads_ready",
    "generating_sequences",
    "review",            # HITL gate 2: user approves sequences
    "approved",
    "sending",
    "complete",
    "failed",
]


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    target_url: Mapped[str] = mapped_column(String, nullable=False)
    leads_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    batch_size: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="queued", nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String, nullable=False)
    credits_charged: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    celery_task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    enrichment_stats: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    icp_profiles: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    discovery_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospect_accounts.id", ondelete="SET NULL"), nullable=True, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="campaigns")
    leads: Mapped[list["Lead"]] = relationship("Lead", back_populates="campaign", cascade="all, delete-orphan")
    sequences: Mapped[list["Sequence"]] = relationship(
        "Sequence", back_populates="campaign", cascade="all, delete-orphan"
    )
    files: Mapped[list["CampaignFile"]] = relationship(
        "CampaignFile", back_populates="campaign", cascade="all, delete-orphan"
    )
    credit_transactions: Mapped[list["CreditTransaction"]] = relationship(
        "CreditTransaction", back_populates="campaign"
    )
    discovery_account: Mapped[Optional["ProspectAccount"]] = relationship(
        "ProspectAccount", back_populates="campaign", foreign_keys=[discovery_account_id]
    )
