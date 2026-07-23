from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ResendConnect(BaseModel):
    api_key: str = Field(min_length=10)
    from_email: str = Field(min_length=5, max_length=320)
    from_name: str = Field(min_length=1, max_length=100)


class ResendStatus(BaseModel):
    connected: bool
    from_email: Optional[str] = None
    from_name: Optional[str] = None
