#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  AmroGen — Google Cloud Run Deployment Script
#  Usage:  GCP_PROJECT_ID=your-project ./deploy.sh [--force-build]
#    --force-build   Rebuild ALL Docker images even if already in registry
#  Deploys: API · Worker · Beat · MCP · Frontend
#  Infra:   Artifact Registry · Cloud Memorystore Redis · VPC Connector
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Flags ──────────────────────────────────────────────────────────────────
FORCE_BUILD=0
for _arg in "$@"; do
  [[ "$_arg" == "--force-build" ]] && FORCE_BUILD=1
done

# ── Configuration ──────────────────────────────────────────────────────────
# Read GCP vars from root .env if not already exported by setup.sh
_ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.env"
if [[ -f "$_ENV_FILE" ]]; then
  _proj=$(grep '^GCP_PROJECT_ID=' "$_ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')
  _reg=$(grep '^GCP_REGION=' "$_ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')
  [[ -n "$_proj" ]] && export GCP_PROJECT_ID="${GCP_PROJECT_ID:-$_proj}"
  [[ -n "$_reg"  ]] && export GCP_REGION="${GCP_REGION:-$_reg}"
fi

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-us-central1}"

# If PROJECT_ID is all digits it's a project number — resolve it to the project ID string
if [[ "$PROJECT_ID" =~ ^[0-9]+$ ]]; then
  echo "  Resolving project number $PROJECT_ID to project ID…"
  PROJECT_ID=$(gcloud projects describe "$PROJECT_ID" --format="value(projectId)")
  echo "  Resolved: $PROJECT_ID"
  # Update .env so future runs use the ID directly
  if [[ -f "$_ENV_FILE" ]]; then
    sed -i.bak "s|^GCP_PROJECT_ID=.*|GCP_PROJECT_ID=${PROJECT_ID}|" "$_ENV_FILE" && rm -f "${_ENV_FILE}.bak"
  fi
fi

REPO="amrogen-images"
IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"

API_SERVICE="amrogen-api"
WORKER_SERVICE="amrogen-worker"
BEAT_SERVICE="amrogen-beat"
FRONTEND_SERVICE="amrogen-frontend"
MCP_SERVICE="amrogen-mcp"

REDIS_INSTANCE="amrogen-redis"
VPC_CONNECTOR="amrogen-vpc-conn"
VPC_NETWORK="default"
VPC_RANGE="10.8.0.0/28"

ENV_FILE=".env"
GCS_KEY_FILE="backend/secrets/gcp-key.json"
GCS_KEY_SECRET="amrogen-gcs-key"
GCS_KEY_PATH="/secrets/gcp-key.json"

# ── Validation ─────────────────────────────────────────────────────────────
if [[ -z "$PROJECT_ID" ]]; then
  echo "✗ Set GCP_PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ Missing $ENV_FILE — run ./setup.sh first"
  exit 1
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  Images  : $IMAGE_BASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Step 1: Enable APIs ────────────────────────────────────────────────────
echo "▶ [1/9] Enabling GCP APIs…"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  redis.googleapis.com \
  vpcaccess.googleapis.com \
  compute.googleapis.com \
  --project="$PROJECT_ID" --quiet

# ── Step 2: Artifact Registry ──────────────────────────────────────────────
echo "▶ [2/9] Setting up Artifact Registry…"
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID" 2>/dev/null \
  || echo "  (repository already exists)"

# ── Step 3: VPC Connector (required for Memorystore) ───────────────────────
echo "▶ [3/9] Setting up VPC connector…"
gcloud compute networks vpc-access connectors create "$VPC_CONNECTOR" \
  --network="$VPC_NETWORK" \
  --region="$REGION" \
  --range="$VPC_RANGE" \
  --project="$PROJECT_ID" 2>/dev/null \
  || echo "  (connector already exists)"

# ── Step 4: Memorystore Redis ──────────────────────────────────────────────
echo "▶ [4/9] Provisioning Memorystore Redis (may take ~5 min if new)…"
gcloud redis instances create "$REDIS_INSTANCE" \
  --size=1 \
  --region="$REGION" \
  --redis-version=redis_7_0 \
  --tier=BASIC \
  --project="$PROJECT_ID" 2>/dev/null \
  || echo "  (instance already exists)"

REDIS_HOST=$(gcloud redis instances describe "$REDIS_INSTANCE" \
  --region="$REGION" --project="$PROJECT_ID" --format="get(host)")
REDIS_PORT=$(gcloud redis instances describe "$REDIS_INSTANCE" \
  --region="$REGION" --project="$PROJECT_ID" --format="get(port)")
REDIS_URL="redis://${REDIS_HOST}:${REDIS_PORT}/0"
echo "  Redis URL: $REDIS_URL"

# ── Step 5: GCS Key Secret ─────────────────────────────────────────────────
echo "▶ [5/9] Uploading GCS service account key to Secret Manager…"
if [[ -f "$GCS_KEY_FILE" ]]; then
  gcloud secrets create "$GCS_KEY_SECRET" \
    --data-file="$GCS_KEY_FILE" \
    --project="$PROJECT_ID" 2>/dev/null \
  || gcloud secrets versions add "$GCS_KEY_SECRET" \
    --data-file="$GCS_KEY_FILE" \
    --project="$PROJECT_ID"
  echo "  GCS key stored as secret: $GCS_KEY_SECRET"
else
  echo "  ⚠ $GCS_KEY_FILE not found — GCS uploads will fail unless you add it"
fi

# ── Grant default compute SA access to the secret ─────────────────────────
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="get(projectNumber)")
SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding "$GCS_KEY_SECRET" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$PROJECT_ID" 2>/dev/null || true

# ── Helpers: Cloud Build (no local Docker needed) ────────────────────────────
# Returns 0 (true) if the image already exists in Artifact Registry
_image_exists() {
  gcloud artifacts docker images describe "$1" \
    --project="$PROJECT_ID" &>/dev/null
}

_build_image() {
  local image="$1"; local dockerfile="$2"; local context="$3"
  shift 3
  local _cb_yaml
  _cb_yaml=$(mktemp /tmp/cloudbuild.XXXX)

  local args="  - build\n  - -t\n  - '${image}'\n  - -f\n  - '${dockerfile}'"
  while [[ $# -gt 0 ]]; do
    args="${args}\n  - '${1}'"
    shift
  done
  args="${args}\n  - '${context}'"

  printf "steps:\n- name: 'gcr.io/cloud-builders/docker'\n  args:\n${args}\nimages:\n- '${image}'\n" > "$_cb_yaml"
  gcloud builds submit . --config="$_cb_yaml" --project="$PROJECT_ID" --quiet
  rm -f "$_cb_yaml"
}

_build_frontend() {
  local api_url="$1"
  local app_url="$2"
  _build_image "${IMAGE_BASE}/frontend:latest" "frontend/Dockerfile" "." \
    "--build-arg" "NEXT_PUBLIC_API_URL=${api_url}" \
    "--build-arg" "NEXT_PUBLIC_APP_URL=${app_url}"
}

# ── Step 6: Build & Push Images ──────────────────────────────────────────────
echo "▶ [6/9] Building and pushing Docker images via Cloud Build…"

echo "  → backend/api"
if [[ "$FORCE_BUILD" -eq 0 ]] && _image_exists "${IMAGE_BASE}/api:latest"; then
  echo "    (already in registry — skipping)"
else
  _build_image "${IMAGE_BASE}/api:latest" "backend/Dockerfile" "./backend"
fi

echo "  → backend/worker"
if [[ "$FORCE_BUILD" -eq 0 ]] && _image_exists "${IMAGE_BASE}/worker:latest"; then
  echo "    (already in registry — skipping)"
else
  _build_image "${IMAGE_BASE}/worker:latest" "backend/Dockerfile.worker.cloud" "./backend"
fi

echo "  → mcp"
if [[ "$FORCE_BUILD" -eq 0 ]] && _image_exists "${IMAGE_BASE}/mcp:latest"; then
  echo "    (already in registry — skipping)"
else
  _build_image "${IMAGE_BASE}/mcp:latest" "mcp/Dockerfile" "./mcp"
fi

echo "  → frontend (placeholder build)"
if [[ "$FORCE_BUILD" -eq 0 ]] && _image_exists "${IMAGE_BASE}/frontend:latest"; then
  echo "    (already in registry — skipping placeholder build)"
else
  _build_frontend "https://placeholder.run.app" "https://placeholder.run.app"
fi

# ── Helper: write Cloud Run env-vars YAML file ─────────────────────────────
# Uses --env-vars-file to avoid --set-env-vars comma-delimiter issues with
# values that themselves contain commas (e.g. ADMIN_EMAILS).
# Returns the path to the temp YAML file; caller must rm it.
write_env_file() {
  local tmpfile
  tmpfile=$(mktemp /tmp/cr-env.XXXX)
  while IFS= read -r line; do
    # Skip blank lines and comments
    [[ "$line" =~ ^[[:space:]]*# || -z "${line// /}" ]] && continue
    local key="${line%%=*}"
    local value="${line#*=}"
    [[ -z "$key" ]] && continue
    # Strip surrounding quotes
    value="${value%\"}" ; value="${value#\"}"
    value="${value%\'}" ; value="${value#\'}"
    # Remap container-incompatible keys
    [[ "$key" == "GOOGLE_APPLICATION_CREDENTIALS" ]] && value="$GCS_KEY_PATH"
    # Skip keys that we inject below with controlled values
    [[ "$key" == "REDIS_URL" || "$key" == "ENVIRONMENT" ]] && continue
    # Escape single quotes for YAML single-quoted scalars
    local safe="${value//\'/\'\'}"
    printf "%s: '%s'\n" "$key" "$safe" >> "$tmpfile"
  done < "$ENV_FILE"
  printf "REDIS_URL: '%s'\n"        "$REDIS_URL"  >> "$tmpfile"
  printf "ENVIRONMENT: 'production'\n"             >> "$tmpfile"
  # Append any extra KEY=VALUE pairs passed as positional args
  for pair in "$@"; do
    local k="${pair%%=*}"
    local v="${pair#*=}"
    local sv="${v//\'/\'\'}"
    printf "%s: '%s'\n" "$k" "$sv" >> "$tmpfile"
  done
  echo "$tmpfile"
}

_run_deploy() {
  gcloud run deploy "$@"
}

# Direct VPC Egress — connects Cloud Run directly to the default VPC without
# needing a Serverless VPC Access connector. Allows reaching Memorystore Redis.
VPC_FLAG="--clear-vpc-connector --network=default --subnet=default --vpc-egress=private-ranges-only"
SECRET_MOUNT="--set-secrets=${GCS_KEY_PATH}=${GCS_KEY_SECRET}:latest"

# ── Step 7: Deploy Backend Services ───────────────────────────────────────
echo "▶ [7/9] Deploying backend services to Cloud Run…"

_API_ENV_FILE=$(write_env_file)

echo "  → $API_SERVICE"
_run_deploy "$API_SERVICE" \
  --image="${IMAGE_BASE}/api:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8000 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=10 \
  --env-vars-file="$_API_ENV_FILE" \
  $VPC_FLAG \
  $SECRET_MOUNT \
  --project="$PROJECT_ID" \
  --quiet
rm -f "$_API_ENV_FILE"

API_URL=$(gcloud run services describe "$API_SERVICE" \
  --region="$REGION" --project="$PROJECT_ID" --format="get(status.url)")
echo "  API URL: $API_URL"

# Patch the Google OAuth redirect URI now that we know the API URL
sed -i.bak "s|GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=${API_URL}/gmail/callback|" .env && rm -f .env.bak
# Update Cloud Run service with the real redirect URI
gcloud run services update "$API_SERVICE" \
  --region="$REGION" --project="$PROJECT_ID" \
  --update-env-vars="GOOGLE_REDIRECT_URI=${API_URL}/gmail/callback,API_BASE_URL=${API_URL}" \
  --quiet

_WORKER_ENV_FILE=$(write_env_file)

echo "  → $WORKER_SERVICE"
_run_deploy "$WORKER_SERVICE" \
  --image="${IMAGE_BASE}/worker:latest" \
  --region="$REGION" \
  --platform=managed \
  --no-allow-unauthenticated \
  --port=8080 \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=3 \
  --no-cpu-throttling \
  --env-vars-file="$_WORKER_ENV_FILE" \
  --command="/app/start_worker.sh" \
  --args="procrastinate,--app,app.tasks.worker_app.worker_app,worker" \
  $VPC_FLAG \
  $SECRET_MOUNT \
  --project="$PROJECT_ID" \
  --quiet
rm -f "$_WORKER_ENV_FILE"

echo "  → $MCP_SERVICE"
_run_deploy "$MCP_SERVICE" \
  --image="${IMAGE_BASE}/mcp:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8001 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --set-env-vars="BACKEND_API_URL=${API_URL}" \
  --project="$PROJECT_ID" \
  --quiet

# ── Step 8: Build & Deploy Frontend with real API URL ─────────────────────
echo "▶ [8/9] Building frontend with real API URL and deploying…"

FRONTEND_URL_TEMP="https://placeholder.run.app"
_build_frontend "${API_URL}" "${FRONTEND_URL_TEMP}"

_run_deploy "$FRONTEND_SERVICE" \
  --image="${IMAGE_BASE}/frontend:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=10 \
  --set-env-vars="NEXT_PUBLIC_API_URL=${API_URL},NODE_ENV=production" \
  --project="$PROJECT_ID" \
  --quiet

FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" \
  --region="$REGION" --project="$PROJECT_ID" --format="get(status.url)")

# Rebuild frontend with its own URL (for serverActions allowedOrigins)
echo "  Rebuilding frontend with its own URL…"
_build_frontend "${API_URL}" "${FRONTEND_URL}"

_run_deploy "$FRONTEND_SERVICE" \
  --image="${IMAGE_BASE}/frontend:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=10 \
  --set-env-vars="NEXT_PUBLIC_API_URL=${API_URL},NEXT_PUBLIC_APP_URL=${FRONTEND_URL},NODE_ENV=production" \
  --project="$PROJECT_ID" \
  --quiet

# ── Step 9: Run DB Migrations ──────────────────────────────────────────────
# Neon PostgreSQL is an external endpoint — no VPC needed for migrations.
# Only DATABASE_URL is required; full env not needed.
echo "▶ [9/9] Running Alembic migrations…"
_DB_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

gcloud run jobs create amrogen-migrate \
  --image="${IMAGE_BASE}/api:latest" \
  --region="$REGION" \
  --command="python" \
  --args="-m,alembic,upgrade,head" \
  --set-env-vars="DATABASE_URL=${_DB_URL}" \
  --project="$PROJECT_ID" 2>/dev/null \
|| gcloud run jobs update amrogen-migrate \
  --image="${IMAGE_BASE}/api:latest" \
  --region="$REGION" \
  --command="python" \
  --args="-m,alembic,upgrade,head" \
  --set-env-vars="DATABASE_URL=${_DB_URL}" \
  --project="$PROJECT_ID"

gcloud run jobs execute amrogen-migrate \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --wait

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Deployment complete!"
echo ""
echo "  Frontend  : $FRONTEND_URL"
echo "  API       : $API_URL"
echo "  Redis     : $REDIS_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
