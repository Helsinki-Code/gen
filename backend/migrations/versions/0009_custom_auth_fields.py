"""add custom auth fields to users

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa


revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "auth_provider_id", nullable=True)

    op.add_column("users", sa.Column("hashed_password", sa.String(), nullable=True))
    op.add_column("users", sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("otp_code", sa.String(6), nullable=True))
    op.add_column("users", sa.Column("otp_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "otp_expires_at")
    op.drop_column("users", "otp_code")
    op.drop_column("users", "is_verified")
    op.drop_column("users", "hashed_password")
    op.alter_column("users", "auth_provider_id", nullable=False)
