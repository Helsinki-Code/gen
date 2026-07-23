from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_provider_id: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    otp_code: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)
    otp_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    credit_balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    schedule_config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    api_keys: Mapped[list["ApiKey"]] = relationship("ApiKey", back_populates="user", lazy="selectin")
    campaigns: Mapped[list["Campaign"]] = relationship("Campaign", back_populates="user")
    gmail_connection: Mapped[Optional["GmailConnection"]] = relationship(
        "GmailConnection", back_populates="user", uselist=False
    )
    resend_connection: Mapped[Optional["ResendConnection"]] = relationship(
        "ResendConnection", back_populates="user", uselist=False
    )
    twilio_connection: Mapped[Optional["TwilioConnection"]] = relationship(
        "TwilioConnection", back_populates="user", uselist=False
    )
    credit_transactions: Mapped[list["CreditTransaction"]] = relationship(
        "CreditTransaction", back_populates="user"
    )
    podcast_episodes: Mapped[list["PodcastEpisode"]] = relationship(
        "PodcastEpisode", back_populates="user", cascade="all, delete-orphan"
    )
    discovery_runs: Mapped[list["DiscoveryRun"]] = relationship(
        "DiscoveryRun", back_populates="user", cascade="all, delete-orphan"
    )
