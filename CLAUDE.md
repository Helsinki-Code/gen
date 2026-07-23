# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# DB migrations
alembic upgrade head
alembic revision --autogenerate -m "description"   # generate new migration

# Run API server
uvicorn app.main:app --reload --port 8000

# Run Celery pipeline worker
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2

# Run Celery beat scheduler (email dispatch every 15 min)
celery -A app.tasks.celery_app beat --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
npm run build
npm run lint
```

### Infrastructure (local)

```bash
# Start Postgres + Redis only
docker compose up db redis -d

# Start full stack (API + worker + beat + MCP + infra)
docker compose up --build

# Stripe webhook forwarding (for local payment testing)
stripe listen --forward-to http://localhost:8000/webhooks/stripe
```

**Access:** Frontend `localhost:3000` · API + Swagger `localhost:8000/docs` · MCP `localhost:8001`

---

## Architecture

```
frontend/          Next.js 14 App Router (client + server components)
backend/
  app/             FastAPI application
    routers/       One file per resource group (campaigns, credits, gmail, …)
    models/        SQLAlchemy ORM models
    schemas/       Pydantic request/response schemas
    services/      Business logic (encryption, gmail, storage, credits, api_keys, …)
    middleware/     auth.py — dual Neon Auth JWT + API key verification
    tasks/         Celery tasks (pipeline, scheduler, discovery)
  agents/          Anthropic Managed Agent wrappers (one file per agent)
  migrations/      Alembic (single migration file: 0001_initial_schema.py)
mcp/               FastMCP server exposing platform as Claude Desktop tools
```

### Auth — custom JWT (not Clerk, not Neon Auth)

Auth is **email/password + JWT** via `/api/amrogen-auth/*` and backend `/auth/*`. Do not add Clerk or Neon Auth.

- **Frontend**: `lib/auth/use-auth-token.ts` — session token from AmroGen auth API
- **Backend**: `app/middleware/auth.py` — `get_current_user()` verifies either:
  - A signed JWT (`JWT_SECRET`, `decode_jwt` in `auth_service.py`)
  - An `amro_sk_` prefixed API key (SHA-256 hash compared against `api_keys` table)

### Anthropic Managed Agents — how they run

All six agents (`lead_generator`, `orchestrator`, `outreach_agent`, `email_agent`, `sms_agent`, `reply_monitor`) follow the same SDK pattern:

```python
session = client.beta.sessions.create(agent={...}, environment_id=ENV_ID, ...)
with client.beta.sessions.events.stream(session_id=session.id) as stream:
    client.beta.sessions.events.send(session_id=session.id, events=[{...user message...}])
    for event in stream:
        # event.type == "agent.message" → collect text
        # event.type == "session.status_idle" → agent finished
```

Agent IDs and environment IDs are hardcoded as defaults in `backend/app/config.py` and can be overridden via env vars. All six agents must be created manually in the Anthropic Console — see README for exact system prompts.

### Critical DB connection pattern for Celery tasks

Postgres closes idle connections after ~5 minutes. Agent runs take 15–25 minutes. **Never hold a DB session open while an agent is running.** The correct pattern (already used in `pipeline_tasks.py`):

```python
db = _get_db_session()
try:
    # read/write campaign state
    db.commit()
finally:
    db.close()   # ← close before calling agent

result = agent_run(...)   # runs 15-25 min, no DB held

db = _get_db_session()    # fresh connection after
try:
    # save results
    db.commit()
finally:
    db.close()
```

### Campaign pipeline flow

`POST /campaigns` → deduct credits → Celery `run_pipeline_task`:
1. Lead Generator Agent runs → leads saved to DB
2. Orchestrator Agent routes each lead to specialist agent(s)
3. Specialist agents (outreach / email / sms) run in batches per `batch_size`
4. Each batch goes through quality review loop (`_run_agent_with_review` in `pipeline_tasks.py`) — orchestrator scores output 1–10, rejects and retries up to 3× if score < 8
5. Sequences saved → status → `review`
6. User reviews/approves in UI
7. `send_due_steps_task` (Celery Beat, every 15 min) dispatches email steps via Gmail API or Resend; SMS via Twilio; LinkedIn steps are never automated

SSE progress events published to Redis (`campaign:{id}:progress`) and consumed by `GET /campaigns/{id}/stream`.

### Storage backend

`services/storage.py` auto-selects: GCS if `GOOGLE_APPLICATION_CREDENTIALS` is set and `GCS_BUCKET_NAME` is non-empty, otherwise falls back to local filesystem at `.local-storage/`. Output files: leads CSV, narrative report MD, sequences JSON, sequences MD.

### Email sending

Two email providers — Resend (preferred if connected) or Gmail OAuth. `scheduler_tasks.py` checks Resend connection first; falls back to Gmail. Twilio handles SMS steps. Gmail tokens are encrypted at rest via Fernet (`services/encryption.py`); GCP KMS is used in production when `KMS_KEY_RESOURCE_NAME` is set.

### Account Discovery (feature flag)

`account_discovery_enabled: bool = False` in config — disabled by default. When enabled, `routers/discoveries.py` + `tasks/discovery_tasks.py` + `services/discovery_*.py` power a multi-shard web research pipeline that finds target company domains from an ICP description. Only publicly-accessible business information is targeted.

### Frontend API client

`lib/api.ts` — all backend calls go through this module. Always pass the token from `useAuthToken()`. `streamCampaignProgress()` in the same file handles the SSE stream connection for the pipeline progress UI.

### Marketing pages

`components/MarketingPage.tsx` is a generic server component used by all marketing pages (`/features/...`, `/alternatives/...`, `/blog/...`, `/pricing`, etc.) via content defined in `lib/marketing-content.ts`. The homepage (`app/(marketing)/page.tsx`) wraps `<MarketingPage>` — override this component to redesign the homepage without touching other marketing pages.

---

## Key env vars

See README for the full list. Minimum for local development:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=amrogen
DB_USER=amro
DB_PASSWORD=amropass
ANTHROPIC_API_KEY=sk-ant-...
LOCAL_ENCRYPTION_KEY=<random-32+-chars>
# Do not set DATABASE_URL or REDIS_URL on Cloud Run (unused red herrings).
```

Agent IDs default to real production values in `config.py` — override only if you create new agents in the console.

---

## Known gotchas

- **`MissingGreenlet` on sequences endpoint** — SQLAlchemy async cannot lazy-load. All sequence queries must use `selectinload(Sequence.steps)` and `selectinload(Sequence.lead)`.
- **`OAUTHLIB_INSECURE_TRANSPORT`** — auto-set in `services/gmail.py` when running locally (http redirect URI). Do not set in production.
- **`OAUTHLIB_RELAX_TOKEN_SCOPE=1`** — set in `services/gmail.py` to suppress Google's scope normalisation warning (`email` → `userinfo.email`).
- **Agent version env vars** — `LEAD_AGENT_VERSION`, `OUTREACH_AGENT_VERSION`, etc. must match the published version number in the Anthropic Console after every agent config update.
- **Credits deducted upfront** — if a pipeline fails, credits are NOT automatically refunded. Manual SQL refund is required (see README troubleshooting section).
