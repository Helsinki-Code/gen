"""Add campaign_events table and procrastinate schema

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-09
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Event buffer: replaces Redis pub/sub for SSE streaming
    op.execute("""
        CREATE TABLE IF NOT EXISTS campaign_events (
            id      BIGSERIAL PRIMARY KEY,
            channel TEXT      NOT NULL,
            payload JSONB     NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_campaign_events_channel_id
        ON campaign_events (channel, id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_campaign_events_created_at
        ON campaign_events (created_at)
    """)

    # Procrastinate task queue schema
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE procrastinate_job_status AS ENUM (
                'todo', 'doing', 'succeeded', 'failed',
                'cancelled', 'aborting', 'aborted'
            );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS procrastinate_jobs (
            id              BIGSERIAL PRIMARY KEY,
            queue_name      TEXT NOT NULL,
            task_name       TEXT NOT NULL,
            lock            TEXT,
            queueing_lock   TEXT,
            args            JSONB NOT NULL DEFAULT '{}',
            status          procrastinate_job_status NOT NULL DEFAULT 'todo',
            scheduled_at    TIMESTAMPTZ DEFAULT NULL,
            attempts        INTEGER NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS procrastinate_periodic_defers (
            id              BIGSERIAL PRIMARY KEY,
            task_name       TEXT NOT NULL,
            defer_timestamp INTEGER,
            queue_id        BIGINT REFERENCES procrastinate_jobs(id) ON DELETE SET NULL,
            CONSTRAINT procrastinate_unique_periodic_defers
                UNIQUE (task_name, defer_timestamp)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS procrastinate_events (
            id         BIGSERIAL PRIMARY KEY,
            job_id     INTEGER NOT NULL REFERENCES procrastinate_jobs(id) ON DELETE CASCADE,
            type       TEXT NOT NULL,
            data       JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS procrastinate_jobs_queue_name_idx
        ON procrastinate_jobs (queue_name)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS procrastinate_jobs_todo_scheduled
        ON procrastinate_jobs (scheduled_at)
        WHERE status = 'todo'
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS procrastinate_jobs_queueing_lock_idx
        ON procrastinate_jobs (queueing_lock)
        WHERE queueing_lock IS NOT NULL AND status = 'todo'
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS procrastinate_events CASCADE")
    op.execute("DROP TABLE IF EXISTS procrastinate_periodic_defers CASCADE")
    op.execute("DROP TABLE IF EXISTS procrastinate_jobs CASCADE")
    op.execute("DROP TYPE IF EXISTS procrastinate_job_status CASCADE")
    op.execute("DROP TABLE IF EXISTS campaign_events CASCADE")
