import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scripts.migrate_production import configure_prod_env, load_prod_database_url
configure_prod_env()

from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

STATEMENTS = [
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_type VARCHAR(32)",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_confidence VARCHAR(8)",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_type VARCHAR(32)",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_confidence VARCHAR(8)",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_website VARCHAR(512)",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_size VARCHAR(128)",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_industry VARCHAR(128)",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_funding_stage VARCHAR(128)",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS icp_fit VARCHAR(16)",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS icp_fit_justification TEXT",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS best_outreach_angle TEXT",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS key_responsibilities TEXT",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS recent_activity TEXT",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_sources JSONB",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_confidence INTEGER",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS verification_status VARCHAR(32) DEFAULT 'unverified' NOT NULL",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS enrichment_stats JSONB",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS icp_profiles JSONB",
    "ALTER TABLE replies ALTER COLUMN gmail_message_id DROP NOT NULL",
    "ALTER TABLE replies ADD COLUMN IF NOT EXISTS campaign_id UUID",
    "ALTER TABLE replies ADD COLUMN IF NOT EXISTS intent VARCHAR(32)",
    "ALTER TABLE replies ADD COLUMN IF NOT EXISTS sentiment_score INTEGER",
    "ALTER TABLE replies ADD COLUMN IF NOT EXISTS next_action VARCHAR(64)",
    "ALTER TABLE replies ADD COLUMN IF NOT EXISTS channel VARCHAR(16)",
    "ALTER TABLE replies ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false NOT NULL",
    "ALTER TABLE replies ADD COLUMN IF NOT EXISTS body_full TEXT",
    "ALTER TABLE replies ADD COLUMN IF NOT EXISTS lead_name VARCHAR(256)",
    "ALTER TABLE replies ADD COLUMN IF NOT EXISTS company VARCHAR(256)",
    """CREATE TABLE IF NOT EXISTS discovery_runs (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(160) NOT NULL, criteria JSONB NOT NULL, requested_accounts INTEGER NOT NULL,
      discovered_accounts INTEGER NOT NULL DEFAULT 0, total_shards INTEGER NOT NULL DEFAULT 0,
      completed_shards INTEGER NOT NULL DEFAULT 0, status VARCHAR(32) NOT NULL DEFAULT 'queued',
      completion_reason VARCHAR(32), error_message TEXT, celery_task_id VARCHAR,
      agent_session_ids JSONB, provider_usage JSONB, query_plan_path VARCHAR, raw_output_path VARCHAR,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), completed_at TIMESTAMPTZ)""",
    "CREATE INDEX IF NOT EXISTS ix_discovery_runs_user_id ON discovery_runs(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_discovery_runs_status ON discovery_runs(status)",
    """CREATE TABLE IF NOT EXISTS discovery_shards (
      id UUID PRIMARY KEY, discovery_run_id UUID NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
      batch_index INTEGER NOT NULL, partition_criteria JSONB NOT NULL, target_accounts INTEGER NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
      query_count INTEGER NOT NULL DEFAULT 0, raw_candidate_count INTEGER NOT NULL DEFAULT 0,
      unique_candidate_count INTEGER NOT NULL DEFAULT 0, error_message TEXT,
      started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(discovery_run_id, batch_index))""",
    "CREATE INDEX IF NOT EXISTS ix_discovery_shards_run ON discovery_shards(discovery_run_id)",
    """CREATE TABLE IF NOT EXISTS discovery_queries (
      id UUID PRIMARY KEY, discovery_run_id UUID NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
      discovery_shard_id UUID NOT NULL REFERENCES discovery_shards(id) ON DELETE CASCADE,
      family VARCHAR(64) NOT NULL, query_text TEXT NOT NULL, provider VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'planned', result_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT, executed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now())""",
    """CREATE TABLE IF NOT EXISTS prospect_accounts (
      id UUID PRIMARY KEY, discovery_run_id UUID NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL, normalized_domain VARCHAR(255) NOT NULL, website_url VARCHAR NOT NULL,
      industry VARCHAR(255), location VARCHAR(255), employee_range VARCHAR(64),
      icp_score INTEGER NOT NULL, signal_score INTEGER NOT NULL, recency_score INTEGER NOT NULL,
      source_quality_score INTEGER NOT NULL, composite_score INTEGER NOT NULL, score_rationale TEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'candidate', selected_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(discovery_run_id, normalized_domain))""",
    "CREATE INDEX IF NOT EXISTS ix_prospect_accounts_run ON prospect_accounts(discovery_run_id)",
    "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS discovery_account_id UUID",
    """CREATE TABLE IF NOT EXISTS research_evidence (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      discovery_run_id UUID REFERENCES discovery_runs(id) ON DELETE CASCADE,
      prospect_account_id UUID REFERENCES prospect_accounts(id) ON DELETE CASCADE,
      campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
      lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
      evidence_kind VARCHAR(64) NOT NULL DEFAULT 'account_signal', signal_type VARCHAR(64) NOT NULL,
      source_url VARCHAR NOT NULL, source_domain VARCHAR(255) NOT NULL, source_title VARCHAR,
      publisher VARCHAR(255), source_type VARCHAR(64) NOT NULL, summary TEXT NOT NULL,
      excerpt VARCHAR(500), published_at TIMESTAMPTZ, observed_at TIMESTAMPTZ NOT NULL,
      source_quality_score INTEGER NOT NULL, confidence_score INTEGER NOT NULL,
      content_hash VARCHAR(64) NOT NULL, evidence_metadata JSONB, created_at TIMESTAMPTZ DEFAULT now())""",
    """CREATE TABLE IF NOT EXISTS sequence_evidence_links (
      id UUID PRIMARY KEY, sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
      evidence_id UUID NOT NULL REFERENCES research_evidence(id) ON DELETE CASCADE,
      UNIQUE(sequence_id, evidence_id))""",
    """CREATE TABLE IF NOT EXISTS bulk_launch_jobs (
      id UUID PRIMARY KEY, discovery_run_id UUID NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, status VARCHAR(32) NOT NULL DEFAULT 'queued',
      leads_per_account INTEGER NOT NULL, batch_size INTEGER NOT NULL, total_accounts INTEGER NOT NULL,
      completed_accounts INTEGER NOT NULL DEFAULT 0, credits_reserved INTEGER NOT NULL,
      error_message TEXT, created_at TIMESTAMPTZ DEFAULT now(), completed_at TIMESTAMPTZ)""",
    """CREATE TABLE IF NOT EXISTS bulk_launch_items (
      id UUID PRIMARY KEY, bulk_launch_job_id UUID NOT NULL REFERENCES bulk_launch_jobs(id) ON DELETE CASCADE,
      prospect_account_id UUID NOT NULL REFERENCES prospect_accounts(id) ON DELETE CASCADE,
      campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL, status VARCHAR(32) NOT NULL DEFAULT 'pending',
      credits_charged INTEGER NOT NULL, error_message TEXT, created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(bulk_launch_job_id, prospect_account_id))""",
    "CREATE INDEX IF NOT EXISTS ix_replies_campaign_id ON replies(campaign_id)",
]


async def main() -> None:
    eng = create_async_engine(load_prod_database_url())
    for i, sql in enumerate(STATEMENTS):
        async with eng.begin() as conn:
            await conn.execute(text(sql))
        print(f"ok {i}")

    async with eng.begin() as conn:
        existing = set(
            (
                await conn.execute(
                    text(
                        "SELECT conname FROM pg_constraint WHERE conname IN "
                        "('fk_campaigns_discovery_account','uq_campaigns_discovery_account','fk_replies_campaign_id')"
                    )
                )
            ).scalars().all()
        )
        if "fk_campaigns_discovery_account" not in existing:
            await conn.execute(
                text(
                    "ALTER TABLE campaigns ADD CONSTRAINT fk_campaigns_discovery_account "
                    "FOREIGN KEY (discovery_account_id) REFERENCES prospect_accounts(id) ON DELETE SET NULL"
                )
            )
        if "uq_campaigns_discovery_account" not in existing:
            await conn.execute(
                text("ALTER TABLE campaigns ADD CONSTRAINT uq_campaigns_discovery_account UNIQUE (discovery_account_id)")
            )
        if "fk_replies_campaign_id" not in existing:
            await conn.execute(
                text(
                    "ALTER TABLE replies ADD CONSTRAINT fk_replies_campaign_id "
                    "FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE"
                )
            )
        print("constraints ok")

    from app.models.user import User
    from app.models.campaign import Campaign
    from app.models.discovery import DiscoveryRun
    from app.models.sequence import Sequence
    from app.models.podcast_episode import PodcastEpisode
    from app.models.lead import Lead

    Session = sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)
    async with Session() as db:
        user = (await db.execute(select(User).where(User.email == "hemant@joshi.me"))).scalar_one()
        print("campaigns", len((await db.execute(select(Campaign).where(Campaign.user_id == user.id))).scalars().all()))
        print("discoveries", len((await db.execute(select(DiscoveryRun).where(DiscoveryRun.user_id == user.id))).scalars().all()))
        for model, field in [
            (Campaign, Campaign.status),
            (Sequence, Sequence.status),
            (PodcastEpisode, PodcastEpisode.status),
        ]:
            rows = (await db.execute(select(field, func.count()).select_from(model).group_by(field))).all()
            print(model.__tablename__, dict(rows))
        print("users", (await db.execute(select(func.count()).select_from(User))).scalar())
        print("leads", (await db.execute(select(func.count()).select_from(Lead))).scalar())
    await eng.dispose()
    print("REPAIR_DONE")


asyncio.run(main())
