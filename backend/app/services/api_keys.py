from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import ApiKey


def generate_api_key() -> tuple[str, str, str]:
    """Returns (full_key, key_prefix, key_hash)."""
    raw = secrets.token_urlsafe(32)
    full_key = f"amro_sk_{raw}"
    prefix = full_key[:16]  # "amro_sk_" + first 8 chars of raw
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    return full_key, prefix, key_hash


async def create_api_key(db: AsyncSession, user_id: uuid.UUID, name: str) -> tuple[ApiKey, str]:
    full_key, prefix, key_hash = generate_api_key()
    api_key = ApiKey(
        user_id=user_id,
        name=name,
        key_prefix=prefix,
        key_hash=key_hash,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    return api_key, full_key


async def get_user_api_keys(db: AsyncSession, user_id: uuid.UUID) -> list[ApiKey]:
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user_id).order_by(ApiKey.created_at.desc())
    )
    return list(result.scalars().all())


async def revoke_api_key(db: AsyncSession, key_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id)
    )
    key = result.scalar_one_or_none()
    if not key:
        return False
    key.is_active = False
    await db.commit()
    return True


async def validate_api_key(db: AsyncSession, raw_key: str) -> ApiKey | None:
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)
    )
    api_key = result.scalar_one_or_none()
    if api_key:
        await db.execute(
            update(ApiKey)
            .where(ApiKey.id == api_key.id)
            .values(last_used_at=datetime.now(timezone.utc))
        )
        await db.commit()
    return api_key
