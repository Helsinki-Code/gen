from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class TwilioConnect(BaseModel):
    account_sid: str = Field(min_length=10, max_length=100)
    auth_token: str = Field(min_length=10, max_length=100)
    # E.164 (+447...) or Twilio alphanumeric sender ID (e.g. AmroGen, max 11 chars)
    from_number: str = Field(min_length=3, max_length=20)


class TwilioStatus(BaseModel):
    connected: bool
    from_number: Optional[str] = None
