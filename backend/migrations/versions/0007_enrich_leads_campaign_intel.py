"""enrich leads table, add campaign intelligence columns, extend replies

Revision ID: 0007
Revises: 0006, 0006b
Create Date: 2026-07-07

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0007"
down_revision: Union[str, Sequence[str], None] = ("0006", "0006b")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── leads: enrichment fields ──────────────────────────────────────────────
    op.add_column("leads", sa.Column("email_type", sa.String(32), nullable=True))
    op.add_column("leads", sa.Column("email_confidence", sa.String(8), nullable=True))
    op.add_column("leads", sa.Column("phone_type", sa.String(32), nullable=True))
    op.add_column("leads", sa.Column("phone_confidence", sa.String(8), nullable=True))
    op.add_column("leads", sa.Column("company_website", sa.String(512), nullable=True))
    op.add_column("leads", sa.Column("company_size", sa.String(128), nullable=True))
    op.add_column("leads", sa.Column("company_industry", sa.String(128), nullable=True))
    op.add_column("leads", sa.Column("company_funding_stage", sa.String(128), nullable=True))
    op.add_column("leads", sa.Column("icp_fit", sa.String(16), nullable=True))
    op.add_column("leads", sa.Column("icp_fit_justification", sa.Text, nullable=True))
    op.add_column("leads", sa.Column("best_outreach_angle", sa.Text, nullable=True))
    op.add_column("leads", sa.Column("key_responsibilities", sa.Text, nullable=True))
    op.add_column("leads", sa.Column("recent_activity", sa.Text, nullable=True))
    op.add_column("leads", sa.Column("data_sources", postgresql.JSONB, nullable=True))

    # ── campaigns: intelligence columns ──────────────────────────────────────
    op.add_column("campaigns", sa.Column("enrichment_stats", postgresql.JSONB, nullable=True))
    op.add_column("campaigns", sa.Column("icp_profiles", postgresql.JSONB, nullable=True))

    # ── replies: make gmail_message_id nullable; add manual-log fields ────────
    op.alter_column("replies", "gmail_message_id", nullable=True)
    op.add_column("replies", sa.Column(
        "campaign_id",
        postgresql.UUID(as_uuid=True),
        sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    ))
    op.add_column("replies", sa.Column("intent", sa.String(32), nullable=True))
    op.add_column("replies", sa.Column("sentiment_score", sa.Integer, nullable=True))
    op.add_column("replies", sa.Column("next_action", sa.String(64), nullable=True))
    op.add_column("replies", sa.Column("channel", sa.String(16), nullable=True))
    op.add_column("replies", sa.Column("is_manual", sa.Boolean, server_default="false", nullable=False))
    op.add_column("replies", sa.Column("body_full", sa.Text, nullable=True))
    op.add_column("replies", sa.Column("lead_name", sa.String(256), nullable=True))
    op.add_column("replies", sa.Column("company", sa.String(256), nullable=True))


def downgrade() -> None:
    # replies
    for col in ("company", "lead_name", "body_full", "is_manual", "channel",
                "next_action", "sentiment_score", "intent", "campaign_id"):
        op.drop_column("replies", col)
    op.alter_column("replies", "gmail_message_id", nullable=False)

    # campaigns
    op.drop_column("campaigns", "icp_profiles")
    op.drop_column("campaigns", "enrichment_stats")

    # leads
    for col in ("data_sources", "recent_activity", "key_responsibilities",
                "best_outreach_angle", "icp_fit_justification", "icp_fit",
                "company_funding_stage", "company_industry", "company_size",
                "company_website", "phone_confidence", "phone_type",
                "email_confidence", "email_type"):
        op.drop_column("leads", col)
