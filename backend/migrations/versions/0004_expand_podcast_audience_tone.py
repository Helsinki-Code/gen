"""expand podcast audience and tone fields

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-02

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "podcast_episodes",
        "audience",
        existing_type=sa.String(80),
        type_=sa.String(300),
        existing_nullable=False,
    )
    op.alter_column(
        "podcast_episodes",
        "tone",
        existing_type=sa.String(64),
        type_=sa.String(300),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "podcast_episodes",
        "tone",
        existing_type=sa.String(300),
        type_=sa.String(64),
        existing_nullable=False,
    )
    op.alter_column(
        "podcast_episodes",
        "audience",
        existing_type=sa.String(300),
        type_=sa.String(80),
        existing_nullable=False,
    )
