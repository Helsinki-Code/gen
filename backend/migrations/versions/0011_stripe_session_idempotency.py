"""add stripe_session_id for checkout idempotency

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa


revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "credit_transactions",
        sa.Column("stripe_session_id", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_credit_transactions_stripe_session_id",
        "credit_transactions",
        ["stripe_session_id"],
        unique=True,
        postgresql_where=sa.text("stripe_session_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_credit_transactions_stripe_session_id", table_name="credit_transactions")
    op.drop_column("credit_transactions", "stripe_session_id")
