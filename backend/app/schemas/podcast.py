from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional
from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator


PodcastSourceType = Literal["product_update", "seo_article", "release_note", "customer_story", "thought_leadership"]
PodcastStatus = Literal["script_ready", "audio_ready", "published", "failed"]


class PodcastCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=180)
    topic: str = Field(min_length=3, max_length=240)
    source_type: PodcastSourceType = "product_update"
    source_url: Optional[str] = Field(default=None, max_length=2048)
    notes: str = Field(default="", max_length=8000)
    audience: str = Field(default="B2B founders and GTM teams", max_length=300)
    tone: str = Field(default="sharp, useful, energetic", max_length=300)
    duration_minutes: int = Field(default=6, ge=2, le=18)
    generate_audio: bool = True

    @field_validator("source_url")
    @classmethod
    def validate_source_url(cls, value: Optional[str]) -> Optional[str]:
        return _validate_source_url(value)


class PodcastAssistantRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=1500)
    title: Optional[str] = Field(default=None, max_length=180)
    topic: str = Field(default="", max_length=240)
    source_type: PodcastSourceType = "product_update"
    source_url: Optional[str] = Field(default=None, max_length=2048)
    notes: str = Field(default="", max_length=8000)
    audience: str = Field(default="B2B founders and GTM teams", max_length=300)
    tone: str = Field(default="sharp, useful, energetic", max_length=300)
    duration_minutes: int = Field(default=6, ge=2, le=18)

    @field_validator("source_url")
    @classmethod
    def validate_source_url(cls, value: Optional[str]) -> Optional[str]:
        return _validate_source_url(value)


def _validate_source_url(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if normalized.startswith("/blog/"):
        if normalized.count("/") != 2 or len(normalized) <= len("/blog/"):
            raise ValueError("Local article paths must use /blog/article-slug.")
        return normalized
    parsed = urlsplit(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Source must be an http(s) URL or a local /blog/article-slug path.")
    return normalized


class PodcastAssistantResponse(BaseModel):
    title: str
    topic: str
    audience: str
    tone: str
    duration_minutes: int
    notes: str
    assistant_message: str
    checklist: list[str] = Field(default_factory=list)


class PodcastIdeaRequest(BaseModel):
    guidance: str = Field(default="", max_length=1500)
    audience: str = Field(default="B2B founders and GTM teams", max_length=300)
    count: int = Field(default=6, ge=3, le=10)
    exclude_topics: list[str] = Field(default_factory=list, max_length=30)


class PodcastIdeaOut(BaseModel):
    id: str
    title: str
    topic: str
    angle: str
    why_now: str
    audience: str
    tone: str
    duration_minutes: int
    source_type: PodcastSourceType
    source_url: Optional[str] = None
    notes: str
    seo_keywords: list[str] = Field(default_factory=list)


class PodcastIdeasResponse(BaseModel):
    ideas: list[PodcastIdeaOut]
    research_summary: str


class PodcastEpisodeOut(BaseModel):
    id: uuid.UUID
    title: str
    topic: str
    source_type: str
    source_url: Optional[str]
    audience: str
    tone: str
    duration_minutes: int
    status: PodcastStatus
    script: str
    summary: str
    show_notes: str
    audio_url: Optional[str]
    audio_mime_type: Optional[str]
    duration_seconds: Optional[int]
    cover_image_url: Optional[str]
    cover_image_mime_type: Optional[str]
    cover_image_alt: Optional[str]
    cover_image_prompt: Optional[str]
    seo_title: Optional[str]
    seo_description: Optional[str]
    seo_content: Optional[str]
    seo_keywords: list[str] = Field(default_factory=list)
    seo_faq: list[dict[str, str]] = Field(default_factory=list)
    publish_url: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime]

    class Config:
        from_attributes = True


class PodcastPublicOut(BaseModel):
    id: uuid.UUID
    title: str
    topic: str
    source_type: str
    source_url: Optional[str]
    audience: str
    tone: str
    duration_minutes: int
    summary: str
    show_notes: str
    audio_url: Optional[str]
    audio_mime_type: Optional[str]
    duration_seconds: Optional[int]
    cover_image_url: Optional[str]
    cover_image_mime_type: Optional[str]
    cover_image_alt: Optional[str]
    cover_image_prompt: Optional[str]
    seo_title: Optional[str]
    seo_description: Optional[str]
    seo_content: Optional[str]
    seo_keywords: list[str] = Field(default_factory=list)
    seo_faq: list[dict[str, str]] = Field(default_factory=list)
    publish_url: Optional[str]
    created_at: datetime
    published_at: Optional[datetime]

    class Config:
        from_attributes = True
