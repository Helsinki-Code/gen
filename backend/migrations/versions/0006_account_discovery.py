"""add scalable account discovery

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-05
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "discovery_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("criteria", postgresql.JSONB(), nullable=False),
        sa.Column("requested_accounts", sa.Integer(), nullable=False),
        sa.Column("discovered_accounts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_shards", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_shards", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("completion_reason", sa.String(32), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("celery_task_id", sa.String(), nullable=True),
        sa.Column("agent_session_ids", postgresql.JSONB(), nullable=True),
        sa.Column("provider_usage", postgresql.JSONB(), nullable=True),
        sa.Column("query_plan_path", sa.String(), nullable=True),
        sa.Column("raw_output_path", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_discovery_runs_user_id", "discovery_runs", ["user_id"])
    op.create_index("ix_discovery_runs_status", "discovery_runs", ["status"])

    op.create_table(
        "discovery_shards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("discovery_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("discovery_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("batch_index", sa.Integer(), nullable=False),
        sa.Column("partition_criteria", postgresql.JSONB(), nullable=False),
        sa.Column("target_accounts", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("query_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("raw_candidate_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unique_candidate_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("discovery_run_id", "batch_index"),
    )
    op.create_index("ix_discovery_shards_run", "discovery_shards", ["discovery_run_id"])
    op.create_index("ix_discovery_shards_status", "discovery_shards", ["status"])

    op.create_table(
        "discovery_queries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("discovery_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("discovery_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("discovery_shard_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("discovery_shards.id", ondelete="CASCADE"), nullable=False),
        sa.Column("family", sa.String(64), nullable=False),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="planned"),
        sa.Column("result_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_discovery_queries_run", "discovery_queries", ["discovery_run_id"])
    op.create_index("ix_discovery_queries_shard", "discovery_queries", ["discovery_shard_id"])

    op.create_table(
        "prospect_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("discovery_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("discovery_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("normalized_domain", sa.String(255), nullable=False),
        sa.Column("website_url", sa.String(), nullable=False),
        sa.Column("industry", sa.String(255), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("employee_range", sa.String(64), nullable=True),
        sa.Column("icp_score", sa.Integer(), nullable=False),
        sa.Column("signal_score", sa.Integer(), nullable=False),
        sa.Column("recency_score", sa.Integer(), nullable=False),
        sa.Column("source_quality_score", sa.Integer(), nullable=False),
        sa.Column("composite_score", sa.Integer(), nullable=False),
        sa.Column("score_rationale", sa.Text(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="candidate"),
        sa.Column("selected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("discovery_run_id", "normalized_domain"),
    )
    op.create_index("ix_prospect_accounts_run", "prospect_accounts", ["discovery_run_id"])
    op.create_index("ix_prospect_accounts_domain", "prospect_accounts", ["normalized_domain"])
    op.create_index("ix_prospect_accounts_score", "prospect_accounts", ["composite_score"])
    op.create_index("ix_prospect_accounts_status", "prospect_accounts", ["status"])

    op.add_column("campaigns", sa.Column("discovery_account_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_campaigns_discovery_account", "campaigns", "prospect_accounts", ["discovery_account_id"], ["id"], ondelete="SET NULL")
    op.create_unique_constraint("uq_campaigns_discovery_account", "campaigns", ["discovery_account_id"])
    op.add_column("leads", sa.Column("contact_confidence", sa.Integer(), nullable=True))
    op.add_column("leads", sa.Column("verification_status", sa.String(32), nullable=False, server_default="unverified"))

    op.create_table(
        "research_evidence",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("discovery_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("discovery_runs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("prospect_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("prospect_accounts.id", ondelete="CASCADE"), nullable=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=True),
        sa.Column("evidence_kind", sa.String(64), nullable=False, server_default="account_signal"),
        sa.Column("signal_type", sa.String(64), nullable=False),
        sa.Column("source_url", sa.String(), nullable=False),
        sa.Column("source_domain", sa.String(255), nullable=False),
        sa.Column("source_title", sa.String(), nullable=True),
        sa.Column("publisher", sa.String(255), nullable=True),
        sa.Column("source_type", sa.String(64), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("excerpt", sa.String(500), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_quality_score", sa.Integer(), nullable=False),
        sa.Column("confidence_score", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("evidence_metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("prospect_account_id IS NOT NULL OR campaign_id IS NOT NULL OR lead_id IS NOT NULL", name="ck_research_evidence_has_subject"),
        sa.UniqueConstraint("prospect_account_id", "content_hash"),
    )
    for column in ("user_id", "discovery_run_id", "prospect_account_id", "campaign_id", "lead_id"):
        op.create_index(f"ix_research_evidence_{column}", "research_evidence", [column])

    op.create_table(
        "sequence_evidence_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sequence_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sequences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("evidence_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("research_evidence.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("sequence_id", "evidence_id"),
    )
    op.create_index("ix_sequence_evidence_sequence", "sequence_evidence_links", ["sequence_id"])
    op.create_index("ix_sequence_evidence_evidence", "sequence_evidence_links", ["evidence_id"])

    op.create_table(
        "bulk_launch_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("discovery_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("discovery_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("leads_per_account", sa.Integer(), nullable=False),
        sa.Column("batch_size", sa.Integer(), nullable=False),
        sa.Column("total_accounts", sa.Integer(), nullable=False),
        sa.Column("completed_accounts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("credits_reserved", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_bulk_launch_jobs_run", "bulk_launch_jobs", ["discovery_run_id"])
    op.create_index("ix_bulk_launch_jobs_user", "bulk_launch_jobs", ["user_id"])
    op.create_index("ix_bulk_launch_jobs_status", "bulk_launch_jobs", ["status"])

    op.create_table(
        "bulk_launch_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("bulk_launch_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bulk_launch_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prospect_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("prospect_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("credits_charged", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("bulk_launch_job_id", "prospect_account_id"),
    )
    op.create_index("ix_bulk_launch_items_job", "bulk_launch_items", ["bulk_launch_job_id"])
    op.create_index("ix_bulk_launch_items_account", "bulk_launch_items", ["prospect_account_id"])


def downgrade() -> None:
    op.drop_table("bulk_launch_items")
    op.drop_table("bulk_launch_jobs")
    op.drop_table("sequence_evidence_links")
    op.drop_table("research_evidence")
    op.drop_column("leads", "verification_status")
    op.drop_column("leads", "contact_confidence")
    op.drop_constraint("uq_campaigns_discovery_account", "campaigns", type_="unique")
    op.drop_constraint("fk_campaigns_discovery_account", "campaigns", type_="foreignkey")
    op.drop_column("campaigns", "discovery_account_id")
    op.drop_table("prospect_accounts")
    op.drop_table("discovery_queries")
    op.drop_table("discovery_shards")
    op.drop_table("discovery_runs")
