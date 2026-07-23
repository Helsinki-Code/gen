from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Reply(Base):
    __tablename__ = "replies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sequence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sequences.id", ondelete="CASCADE"), index=True
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=True, index=True
    )
    step_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sequence_steps.id", ondelete="SET NULL"), nullable=True
    )

    # Contact context (denormalised for quick display)
    lead_name: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    # Message data
    channel: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # email | sms
    gmail_message_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, unique=True)
    from_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    subject: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    body_preview: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_full: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Classification
    intent: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    sentiment_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    next_action: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    action: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # Source
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sequence: Mapped["Sequence"] = relationship("Sequence", back_populates="replies")
    step: Mapped[Optional["SequenceStep"]] = relationship("SequenceStep", back_populates="replies")
