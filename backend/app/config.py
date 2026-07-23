from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal, Optional
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _env_files() -> tuple[str, ...]:
    # Later files override earlier ones — .env.local wins for local dev.
    files: list[str] = []
    for name in (".env", ".env.production", ".env.local"):
        if os.path.exists(name):
            files.append(name)
    return tuple(files) if files else (".env",)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_files(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Environment
    environment: Literal["development", "staging", "production"] = "development"
    api_base_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3001"

    # Database — prefer DB_* on Cloud Run; optional DATABASE_URL (e.g. local docker-compose)
    database_url: str = ""
    db_host: str = ""
    db_port: int = 5432
    db_name: str = ""
    db_user: str = ""
    db_password: str = ""
    db_ssl: str = "false"

    # Redis (kept for backward-compat env vars; not used in new code)
    redis_url: Optional[str] = None

    # Anthropic Managed Agents — must be created under the AmroGen Anthropic org
    # (do not reuse third-party agent/vault IDs). Set via env after Console setup.
    anthropic_api_key: str = ""
    lead_agent_id: str = ""
    lead_agent_version: int = 1
    lead_env_id: str = ""
    outreach_agent_id: str = ""
    outreach_agent_version: int = 1
    outreach_env_id: str = ""
    vault_ids: str = ""  # comma-separated AmroGen vault IDs

    # Anthropic Managed Agents — specialist team
    email_agent_id: str = ""
    email_agent_version: int = 1
    email_env_id: str = ""

    sms_agent_id: str = ""
    sms_agent_version: int = 1
    sms_env_id: str = ""

    reply_monitor_agent_id: str = ""
    reply_monitor_agent_version: int = 1
    reply_monitor_env_id: str = ""

    orchestrator_agent_id: str = ""
    orchestrator_agent_version: int = 1
    orchestrator_env_id: str = ""

    # Native multi-agent coordinator (wired via wire_multiagent.py)
    coordinator_agent_id: str = ""
    coordinator_env_id: str = ""

    @property
    def vault_ids_list(self) -> list[str]:
        return [v.strip() for v in self.vault_ids.split(",") if v.strip()]

    # Auth
    admin_emails: str = "info@agentic-ai.ltd"
    # When true, allowlisted admins must complete MFA even in development
    force_mfa_for_admin: bool = False

    # Stripe — 10-campaign pack price IDs (one-time)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_starter: str = ""
    stripe_price_professional: str = ""
    stripe_price_enterprise: str = ""
    # Legacy aliases (read if new names empty — remove after Cloud Run migrated)
    stripe_price_growth: str = ""
    stripe_price_scale: str = ""

    # Google OAuth (Gmail)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/gmail/callback"
    gemini_api_key: str = ""
    gemini_tts_model: str = "gemini-2.5-pro-preview-tts"
    gemini_assistant_model: str = "gemini-3.1-pro-preview"
    gemini_image_model: str = "gemini-3.1-flash-lite-image"

    # GCS
    gcs_bucket_name: str = "amrogen-campaigns"
    google_application_credentials: str = ""
    storage_backend: Literal["auto", "gcs", "local"] = "auto"
    local_storage_dir: str = ".local-storage"

    # GCP KMS (blank = use local AES key)
    kms_key_resource_name: str = ""
    local_encryption_key: str = "dev-only-32-byte-secret-key-here!"

    # Credits
    credits_per_lead_gen: int = 5      # per 10-lead campaign
    credits_per_outreach: int = 3      # per 10-lead outreach
    credits_per_pipeline: int = 8      # full pipeline (lead gen + outreach)
    credit_price_cents: int = 35       # $0.35 per credit (PAYG)

    # Anthropic webhook (optional — set to verify incoming webhooks)
    anthropic_webhook_secret: str = ""

    # Transactional email (system Resend key — separate from per-user Resend connections)
    resend_api_key: str = ""
    resend_from_email: str = "AmroGen <noreply@amrogen.com>"

    # Daily ops digest (activity + failures) → info@amrogen.com
    # Protect POST /internal/cron/daily-digest with Authorization: Bearer {CRON_SECRET}
    cron_secret: str = ""
    daily_digest_to: str = "info@amrogen.com"
    daily_digest_enabled: bool = True

    # Daily keys / Stripe / DB report → DAILY_KEYS_REPORT_EMAIL (fallback: DAILY_DIGEST_TO)
    # Protect GET /internal/cron/keys-topup-report with Authorization: Bearer {CRON_SECRET}
    daily_keys_report_email: str = "info@amrogen.com"
    admin_issue_email: str = "info@amrogen.com"
    # empty = enable in production only; "true"/"false" overrides
    admin_issue_notify: str = ""

    # Misc
    jwt_secret: str = "change-me-in-production"
    jwt_expiry_days: int = 7

    # Account discovery (disabled by default — enable when discovery agent env is configured)
    account_discovery_enabled: bool = False
    discovery_max_accounts: int = 100
    discovery_active_runs_per_user: int = 2
    discovery_shard_size: int = 25
    discovery_queries_per_shard: int = 5
    discovery_agent_id: str = ""
    discovery_env_id: str = ""
    discovery_agent_version: int = 1

    @model_validator(mode="after")
    def resolve_database_url(self) -> "Settings":
        if self.database_url.strip():
            return self
        if self.db_host.strip():
            ssl = self.db_ssl.lower() in ("1", "true", "yes", "require")
            query = "?ssl=require" if ssl else ""
            password = quote_plus(self.db_password)
            url = (
                f"postgresql+asyncpg://{self.db_user}:{password}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}{query}"
            )
            object.__setattr__(self, "database_url", url)
            return self
        object.__setattr__(
            self,
            "database_url",
            "postgresql+asyncpg://amro:amropass@localhost:5432/amrogen",
        )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
