"""add podcast studio

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-30

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "podcast_episodes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("topic", sa.String(240), nullable=False),
        sa.Column("source_type", sa.String(48), nullable=False, server_default="product_update"),
        sa.Column("source_url", sa.String(), nullable=True),
        sa.Column("audience", sa.String(80), nullable=False, server_default="B2B founders and GTM teams"),
        sa.Column("tone", sa.String(64), nullable=False, server_default="sharp, useful, energetic"),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="6"),
        sa.Column("status", sa.String(32), nullable=False, server_default="script_ready"),
        sa.Column("script", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("show_notes", sa.Text(), nullable=False),
        sa.Column("audio_path", sa.String(), nullable=True),
        sa.Column("audio_mime_type", sa.String(96), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("publish_url", sa.String(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_podcast_episodes_user_id", "podcast_episodes", ["user_id"])
    op.create_index("ix_podcast_episodes_status", "podcast_episodes", ["status"])


def downgrade() -> None:
    op.drop_index("ix_podcast_episodes_status", table_name="podcast_episodes")
    op.drop_index("ix_podcast_episodes_user_id", table_name="podcast_episodes")
    op.drop_table("podcast_episodes")
