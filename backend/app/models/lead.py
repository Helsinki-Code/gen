from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), index=True
    )
    row_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Core contact info
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    email_confidence: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    phone_confidence: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Company intel
    company_website: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    company_size: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    company_industry: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    company_funding_stage: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # ICP scoring
    icp_fit_score: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    icp_fit: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    icp_fit_justification: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Enrichment intelligence
    best_outreach_angle: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    key_responsibilities: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recent_activity: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data_sources: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="leads")
    sequence: Mapped[Optional["Sequence"]] = relationship("Sequence", back_populates="lead", uselist=False)
