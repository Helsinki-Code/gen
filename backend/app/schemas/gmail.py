from __future__ import annotations

from pydantic import BaseModel


class GmailAuthUrl(BaseModel):
    auth_url: str


class GmailStatus(BaseModel):
    connected: bool
    gmail_email: str | None
