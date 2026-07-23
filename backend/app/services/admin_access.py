from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.config import get_settings
from app.middleware.auth import CurrentUser
from app.models.user import User


DEFAULT_ADMIN_EMAILS = {
    "vikram@vranceflex.online",
    "info@agentic-ai.ltd",
    "hemant@joshi.me",
    "sa@amrogen.com",
    "info@amrogen.com",
}


def admin_emails() -> set[str]:
    settings = get_settings()
    configured = {
        email.strip().lower()
        for email in settings.admin_emails.split(",")
        if email.strip()
    }
    return DEFAULT_ADMIN_EMAILS | configured


def is_admin_email(email: str | None) -> bool:
    return bool(email and email.lower() in admin_emails())


def require_admin(current_user: CurrentUser) -> User:
    if not is_admin_email(current_user.email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required for this workspace area.",
        )
    return current_user


AdminUser = Annotated[User, Depends(require_admin)]
