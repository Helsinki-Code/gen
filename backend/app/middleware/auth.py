from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services import api_keys as api_key_service
from app.services.auth_service import decode_jwt

bearer = HTTPBearer(auto_error=False)


async def _get_user_by_api_key(db: AsyncSession, raw_key: str) -> Optional[User]:
    api_key = await api_key_service.validate_api_key(db, raw_key)
    if not api_key:
        return None
    result = await db.execute(select(User).where(User.id == api_key.user_id))
    return result.scalar_one_or_none()


async def _get_user_by_jwt(db: AsyncSession, token: str) -> Optional[User]:
    payload = decode_jwt(token)
    if not payload or not payload.get("sub"):
        return None
    # MFA challenge / setup tokens are not full sessions
    if payload.get("mfaPending") or payload.get("mfaSetup"):
        return None
    try:
        user_id = uuid.UUID(str(payload["sub"]))
    except ValueError:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)],
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = credentials.credentials

    if token.startswith("amro_sk_"):
        user = await _get_user_by_api_key(db, token)
        if user:
            return user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    user = await _get_user_by_jwt(db, token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
