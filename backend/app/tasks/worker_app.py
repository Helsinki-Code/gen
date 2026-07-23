from __future__ import annotations

import asyncio
import json
import logging

import procrastinate

from app.config import get_settings

settings = get_settings()
_log = logging.getLogger("amrogen")
_open_lock = asyncio.Lock()
_opened = False


def _pg_conninfo() -> str:
    """Convert postgresql+asyncpg://... to a psycopg3-compatible conninfo string."""
    url = settings.database_url
    conninfo = url.replace("postgresql+asyncpg://", "postgresql://")
    return conninfo.replace("?ssl=require", "?sslmode=require")


# PsycopgConnector is lazy: the pool is only created when open_async() runs,
# so passing conninfo here does not connect at import time.
worker_app = procrastinate.App(
    connector=procrastinate.PsycopgConnector(
        conninfo=_pg_conninfo(),
        json_dumps=lambda v: json.dumps(v, default=str),
    ),
    import_paths=[
        "app.tasks.pipeline_tasks",
        "app.tasks.discovery_tasks",
        "app.tasks.scheduler_tasks",
        "app.tasks.digest_tasks",
        "app.tasks.keys_topup_tasks",
    ],
)


async def ensure_worker_open() -> None:
    """Open the queue connector once; safe to call from request handlers."""
    global _opened
    if _opened:
        return
    async with _open_lock:
        if _opened:
            return
        await asyncio.wait_for(worker_app.open_async(), timeout=30)
        _opened = True
        _log.info("Procrastinate worker_app opened")
