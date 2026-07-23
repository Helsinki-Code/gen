from __future__ import annotations

from datetime import datetime, timezone


SOURCE_QUALITY = {
    "company": 100,
    "regulator": 100,
    "official_filing": 100,
    "reputable_news": 80,
    "industry_publication": 80,
    "conference": 65,
    "association": 65,
    "directory": 65,
    "aggregator": 40,
}


def clamp_score(value, default: int = 0) -> int:
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):
        return default


def recency_score(published_at: datetime | None, now: datetime | None = None) -> int:
    if not published_at:
        return 10
    current = now or datetime.now(timezone.utc)
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    days = max(0, (current - published_at).days)
    if days <= 30:
        return 100
    if days <= 90:
        return 75
    if days <= 180:
        return 50
    if days <= 365:
        return 25
    return 10


def source_quality_score(source_type: str) -> int:
    return SOURCE_QUALITY.get((source_type or "").strip().lower(), 0)


def composite_score(icp: int, signal: int, recency: int, source_quality: int) -> int:
    return clamp_score(icp * 0.40 + signal * 0.30 + recency * 0.15 + source_quality * 0.15)
