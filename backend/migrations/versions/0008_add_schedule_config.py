"""add schedule_config to users

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("schedule_config", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("users", "schedule_config")
