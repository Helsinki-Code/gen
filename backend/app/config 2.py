from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Environment
    environment: Literal["development", "staging", "production"] = "development"
    api_base_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql+asyncpg://amro:amropass@localhost:5432/amrogen"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Anthropic Managed Agents — original
    anthropic_api_key: str = ""
    lead_agent_id: str = "agent_01KCgXZcjJZRaYwRbi2r9K1X"
    lead_agent_version: int = 13
    lead_env_id: str = "env_01C4zsjtywbWyySzsZAvWo13"
    outreach_agent_id: str = "agent_01D7g9o5XzCspaHvumMZCoVL"
    outreach_agent_version: int = 2
    outreach_env_id: str = "env_019wZ96NQm6d24JbFh6WBBK6"
    vault_ids: str = "vlt_011CcQh9hjthMR6Lwet53s89"  # comma-separated

    # Anthropic Managed Agents — specialist team
    email_agent_id: str = "agent_01PeijWEjY6zAxLzhBo3qQ5z"
    email_agent_version: int = 1
    email_env_id: str = "env_01U67Aa1myndo2Sg53xk5MtX"

    sms_agent_id: str = "agent_014gUHgKvGw6VEErqQjM79VG"
    sms_agent_version: int = 1
    sms_env_id: str = "env_01UNr7xVRoMBFGEaxn91huSg"

    reply_monitor_agent_id: str = "agent_01PVokWENoRKua8bHqmBGupM"
    reply_monitor_agent_version: int = 1
    reply_monitor_env_id: str = "env_014DEHQKvjFCc4tfsoxG2JgX"

    orchestrator_agent_id: str = "agent_019Ec4AdfBmc98dKqfgyRUsL"
    orchestrator_agent_version: int = 2
    orchestrator_env_id: str = "env_016dFa6ru6TPpSc1C2TwgYMT"

    @property
    def vault_ids_list(self) -> list[str]:
        return [v.strip() for v in self.vault_ids.split(",") if v.strip()]

    # Auth
    neon_auth_jwks_url: str = "https://ep-withered-wave-atxvrk7h.neonauth.c-9.us-east-1.aws.neon.tech/neondb/auth/.well-known/jwks.json"
    neon_auth_issuer: str = ""
    admin_emails: str = "vikram@vranceflex.online,info@agentic-ai.ltd"

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_starter: str = ""
    stripe_price_growth: str = ""
    stripe_price_scale: str = ""

    # Google OAuth (Gmail)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/gmail/callback"
    gemini_api_key: str = ""
    gemini_tts_model: str = "gemini-2.5-pro-preview-tts"
    gemini_assistant_model: str = "gemini-3.1-pro-preview"

    # GCS
    gcs_bucket_name: str = "amrogen-campaigns"
    google_application_credentials: str = ""

    # GCP KMS (blank = use local AES key)
    kms_key_resource_name: str = ""
    local_encryption_key: str = "dev-only-32-byte-secret-key-here!"

    # Credits
    credits_per_lead_gen: int = 5      # per 10-lead campaign
    credits_per_outreach: int = 3      # per 10-lead outreach
    credits_per_pipeline: int = 8      # full pipeline (lead gen + outreach)
    credit_price_cents: int = 35       # $0.35 per credit (PAYG)

    # Misc
    jwt_secret: str = "change-me-in-production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
