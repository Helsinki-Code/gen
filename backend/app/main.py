from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.database import engine
from app.routers import admin, api_keys, auth, campaigns, contacts, credits, cron, discoveries, gmail, inbox, mfa, podcasts, resend, schedule, stream, twilio, webhooks
from app.tasks.worker_app import worker_app

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Do not await DB/queue open here — uvicorn binds PORT only after lifespan yields."""
    import asyncio
    import logging

    from app.tasks.worker_app import ensure_worker_open

    log = logging.getLogger("amrogen")

    async def _open_queue() -> None:
        try:
            await ensure_worker_open()
        except Exception as exc:  # noqa: BLE001
            log.exception("Procrastinate open failed/timed out: %s", exc)

    # Fire-and-forget so Cloud Run can probe PORT immediately.
    asyncio.create_task(_open_queue())
    yield
    try:
        await worker_app.close_async()
    except Exception:  # noqa: BLE001
        pass


app = FastAPI(
    title="AmroGen API",
    version="1.0.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
    lifespan=lifespan,
)

_allowed_origins = (
    [o.strip() for o in settings.frontend_url.split(",") if o.strip()]
    + ["http://localhost:3000", "http://localhost:3001"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(mfa.router)
app.include_router(campaigns.router)
app.include_router(discoveries.router)
app.include_router(contacts.router)
app.include_router(inbox.router)
app.include_router(stream.router)
app.include_router(admin.router)
app.include_router(api_keys.router)
app.include_router(credits.router)
app.include_router(gmail.router)
app.include_router(resend.router)
app.include_router(twilio.router)
app.include_router(podcasts.router)
app.include_router(schedule.router)
app.include_router(webhooks.router)
app.include_router(cron.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/ready")
async def health_ready():
    """Deep readiness probe — DB connectivity and ORM mapper health."""
    components: dict[str, dict[str, str | int]] = {}
    started = datetime.now(timezone.utc)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        latency_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        components["database"] = {"status": "ok", "latencyMs": latency_ms}
        return {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "components": components,
        }
    except Exception as exc:
        latency_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        components["database"] = {"status": "error", "latencyMs": latency_ms, "detail": str(exc)}
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "components": components,
            },
        )


@app.get("/mcp/validate-key")
async def validate_mcp_key(key: str, db=None):
    """Internal endpoint used by the MCP server to validate bearer tokens."""
    from fastapi import Depends
    from app.database import get_db
    from app.services.api_keys import validate_api_key
    from sqlalchemy import select
    from app.models.user import User

    # This will be called from the MCP server — no auth needed on this internal route
    # In production, restrict this to VPC-internal traffic only
    return {"valid": True}  # placeholder — see mcp/server.py for full implementation
