from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PodcastEpisode(Base):
    __tablename__ = "podcast_episodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    topic: Mapped[str] = mapped_column(String(240), nullable=False)
    source_type: Mapped[str] = mapped_column(String(48), nullable=False, default="product_update")
    source_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    audience: Mapped[str] = mapped_column(String(300), nullable=False, default="B2B founders and GTM teams")
    tone: Mapped[str] = mapped_column(String(300), nullable=False, default="sharp, useful, energetic")
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="script_ready", index=True)
    script: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    show_notes: Mapped[str] = mapped_column(Text, nullable=False)
    audio_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    audio_mime_type: Mapped[Optional[str]] = mapped_column(String(96), nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cover_image_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    cover_image_mime_type: Mapped[Optional[str]] = mapped_column(String(96), nullable=True)
    cover_image_alt: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    cover_image_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    seo_title: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    seo_description: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    seo_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    seo_keywords: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    seo_faq: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    publish_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="podcast_episodes")
