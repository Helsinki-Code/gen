"""rename auth provider id

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-30

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_users_clerk_id", table_name="users")
    op.alter_column("users", "clerk_id", new_column_name="auth_provider_id")
    op.create_index("ix_users_auth_provider_id", "users", ["auth_provider_id"])


def downgrade() -> None:
    op.drop_index("ix_users_auth_provider_id", table_name="users")
    op.alter_column("users", "auth_provider_id", new_column_name="clerk_id")
    op.create_index("ix_users_clerk_id", "users", ["clerk_id"])
