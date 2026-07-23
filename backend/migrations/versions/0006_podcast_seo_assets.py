"""add podcast seo and cover assets

Revision ID: 0006b
Revises: 0005
Create Date: 2026-07-06

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006b"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("podcast_episodes", sa.Column("cover_image_path", sa.String(), nullable=True))
    op.add_column("podcast_episodes", sa.Column("cover_image_mime_type", sa.String(96), nullable=True))
    op.add_column("podcast_episodes", sa.Column("cover_image_alt", sa.String(320), nullable=True))
    op.add_column("podcast_episodes", sa.Column("cover_image_prompt", sa.Text(), nullable=True))
    op.add_column("podcast_episodes", sa.Column("seo_title", sa.String(180), nullable=True))
    op.add_column("podcast_episodes", sa.Column("seo_description", sa.String(320), nullable=True))
    op.add_column("podcast_episodes", sa.Column("seo_content", sa.Text(), nullable=True))
    op.add_column("podcast_episodes", sa.Column("seo_keywords", sa.Text(), nullable=True))
    op.add_column("podcast_episodes", sa.Column("seo_faq", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("podcast_episodes", "seo_faq")
    op.drop_column("podcast_episodes", "seo_keywords")
    op.drop_column("podcast_episodes", "seo_content")
    op.drop_column("podcast_episodes", "seo_description")
    op.drop_column("podcast_episodes", "seo_title")
    op.drop_column("podcast_episodes", "cover_image_prompt")
    op.drop_column("podcast_episodes", "cover_image_alt")
    op.drop_column("podcast_episodes", "cover_image_mime_type")
    op.drop_column("podcast_episodes", "cover_image_path")
