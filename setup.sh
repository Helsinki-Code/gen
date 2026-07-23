#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  AmroGen — Interactive Setup & Deploy
#  Reads .env, prompts only for missing/placeholder values, then deploys.
#  Usage:  chmod +x setup.sh && ./setup.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

BOLD="\033[1m"
DIM="\033[2m"
GREEN="\033[0;32m"
TEAL="\033[0;36m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
GCS_KEY_DEST="$SCRIPT_DIR/backend/secrets/gcp-key.json"

header() { echo -e "\n${BOLD}${TEAL}━━━  $1  ━━━${RESET}"; }
label()  { echo -e "${BOLD}${GREEN}  $1${RESET}"; }
hint()   { echo -e "${DIM}    $1${RESET}"; }
warn()   { echo -e "${YELLOW}  ⚠  $1${RESET}"; }
ok()     { echo -e "${GREEN}  ✓  $1${RESET}"; }
skip()   { echo -e "${DIM}  ↩  $1 — already set${RESET}"; }

# ── .env read/write helpers ─────────────────────────────────────────────────

# Get current value of a key from .env (returns empty string if key missing)
get_val() {
  local key="$1"
  grep "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-
}

# True if value is empty or a known placeholder
is_missing() {
  local val="$1"
  [[ -z "$val" ]] && return 0
  case "$val" in
    *YOUR-API-URL* | *YOUR-FRONTEND-URL* | *user:password@host* | \
    "sk-ant-api03-..." | "re_..." | "sk_live_..." | "whsec_..." | \
    "price_..." | "AIza..." | "sk-proj-..." | "you@yourdomain.com" | \
    "GOCSPX-..." | "...apps.googleusercontent.com" | \
    "AmroGen <noreply@yourdomain.com>")
      return 0 ;;
    *) return 1 ;;
  esac
}

# Write or update KEY=VALUE in .env (preserves comments and order)
set_val() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

# Prompt for a value. If the current value is non-empty show it as default.
# Sets global REPLY_VAL.
prompt() {
  local lbl="$1"
  local desc="${2:-}"
  local default="${3:-}"
  local secret="${4:-}"

  label "$lbl"
  [[ -n "$desc" ]] && hint "$desc"

  if [[ -n "$secret" ]]; then
    [[ -n "$default" ]] && echo -ne "  ${DIM}[press Enter to keep current]${RESET} → " \
                        || echo -ne "  → "
    read -rs REPLY_VAL; echo ""
  else
    [[ -n "$default" ]] && echo -ne "  ${DIM}[$default]${RESET} → " \
                        || echo -ne "  → "
    read -r REPLY_VAL
  fi

  [[ -z "$REPLY_VAL" && -n "$default" ]] && REPLY_VAL="$default"
}

# Prompt until non-empty. Sets global REPLY_VAL.
prompt_required() {
  while true; do
    prompt "$@"
    [[ -n "$REPLY_VAL" ]] && break
    warn "This field is required — please enter a value."
  done
}

gen_secret() { openssl rand -hex 32 2>/dev/null; }
gen_key32()  { openssl rand -base64 24 2>/dev/null | cut -c1-32; }

# ── Main ────────────────────────────────────────────────────────────────────
clear
echo ""
echo -e "${BOLD}${TEAL}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║       AmroGen — Setup & Deploy Wizard         ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo -e "${RESET}"

if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env not found — creating from .env.example"
  cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
fi

ok "Reading $ENV_FILE — will only ask for missing or placeholder values."
echo ""
read -rp "  Press Enter to begin…"

ASKED=0

# ════════════════════════════════════════════════════════════════════════════
header "1 · GCP Deployment"

val=$(get_val GCP_PROJECT_ID)
if is_missing "$val"; then
  prompt_required "GCP Project ID  [REQUIRED]" \
    "Find it at console.cloud.google.com — e.g. my-project-123456"
  set_val GCP_PROJECT_ID "$REPLY_VAL"; ((ASKED++))
else
  skip "GCP_PROJECT_ID ($val)"
fi

val=$(get_val GCP_REGION)
if is_missing "$val"; then
  prompt "GCP Region" "Cloud Run / Redis region" "us-central1"
  set_val GCP_REGION "$REPLY_VAL"; ((ASKED++))
else
  skip "GCP_REGION ($val)"
fi

# ════════════════════════════════════════════════════════════════════════════
header "2 · Database"

val=$(get_val DATABASE_URL)
if is_missing "$val"; then
  prompt_required "DATABASE_URL  [REQUIRED]" \
    "e.g. postgresql+asyncpg://user:pass@ep-xxx.neon.tech/neondb?ssl=require"
  set_val DATABASE_URL "$REPLY_VAL"; ((ASKED++))
else
  skip "DATABASE_URL ($(echo "$val" | sed 's|://[^@]*@|://***@|'))"
fi

# ════════════════════════════════════════════════════════════════════════════
header "3 · Auth & Security"

val=$(get_val JWT_SECRET)
if is_missing "$val"; then
  _def=$(gen_secret)
  prompt "JWT_SECRET" "Auto-generated random value shown — press Enter to accept" "$_def" secret
  set_val JWT_SECRET "$REPLY_VAL"; ((ASKED++))
else
  skip "JWT_SECRET (already set)"
fi

val=$(get_val LOCAL_ENCRYPTION_KEY)
if is_missing "$val"; then
  _def=$(gen_key32)
  prompt "LOCAL_ENCRYPTION_KEY (32 chars)" "Auto-generated — press Enter to accept" "$_def" secret
  set_val LOCAL_ENCRYPTION_KEY "$REPLY_VAL"; ((ASKED++))
else
  skip "LOCAL_ENCRYPTION_KEY (already set)"
fi

val=$(get_val ADMIN_EMAILS)
if is_missing "$val"; then
  prompt "ADMIN_EMAILS" "Comma-separated emails with /admin access" "you@yourdomain.com"
  set_val ADMIN_EMAILS "$REPLY_VAL"; ((ASKED++))
else
  skip "ADMIN_EMAILS ($val)"
fi

# ════════════════════════════════════════════════════════════════════════════
header "4 · Anthropic AI"

val=$(get_val ANTHROPIC_API_KEY)
if is_missing "$val"; then
  prompt_required "ANTHROPIC_API_KEY  [REQUIRED]" \
    "Get from console.anthropic.com → API Keys" "" secret
  set_val ANTHROPIC_API_KEY "$REPLY_VAL"; ((ASKED++))
else
  skip "ANTHROPIC_API_KEY (already set)"
fi

# Agent IDs — write defaults only if completely absent from file
for kv in \
  "LEAD_AGENT_ID:agent_01KCgXZcjJZRaYwRbi2r9K1X" \
  "LEAD_AGENT_VERSION:13" \
  "LEAD_ENV_ID:env_01C4zsjtywbWyySzsZAvWo13" \
  "OUTREACH_AGENT_ID:agent_01D7g9o5XzCspaHvumMZCoVL" \
  "OUTREACH_AGENT_VERSION:2" \
  "OUTREACH_ENV_ID:env_019wZ96NQm6d24JbFh6WBBK6" \
  "EMAIL_AGENT_ID:agent_01PeijWEjY6zAxLzhBo3qQ5z" \
  "EMAIL_AGENT_VERSION:1" \
  "EMAIL_ENV_ID:env_01U67Aa1myndo2Sg53xk5MtX" \
  "SMS_AGENT_ID:agent_014gUHgKvGw6VEErqQjM79VG" \
  "SMS_AGENT_VERSION:1" \
  "SMS_ENV_ID:env_01UNr7xVRoMBFGEaxn91huSg" \
  "REPLY_MONITOR_AGENT_ID:agent_01PVokWENoRKua8bHqmBGupM" \
  "REPLY_MONITOR_AGENT_VERSION:1" \
  "REPLY_MONITOR_ENV_ID:env_014DEHQKvjFCc4tfsoxG2JgX" \
  "ORCHESTRATOR_AGENT_ID:agent_019Ec4AdfBmc98dKqfgyRUsL" \
  "ORCHESTRATOR_AGENT_VERSION:2" \
  "ORCHESTRATOR_ENV_ID:env_016dFa6ru6TPpSc1C2TwgYMT" \
  "COORDINATOR_AGENT_ID:agent_01JAyqvv27nDwHw49Rcj7bEA" \
  "COORDINATOR_ENV_ID:env_01XGUjfcnXQQmih4b31yMTY6" \
  "VAULT_IDS:vlt_011CcQh9hjthMR6Lwet53s89"
do
  k="${kv%%:*}"; v="${kv#*:}"
  existing=$(get_val "$k")
  if [[ -z "$existing" ]]; then
    set_val "$k" "$v"
  fi
done
echo -e "  ${DIM}Agent IDs — defaults written for any that were missing${RESET}"

# ════════════════════════════════════════════════════════════════════════════
header "5 · Resend (Transactional Email)"

val=$(get_val RESEND_API_KEY)
if is_missing "$val"; then
  prompt_required "RESEND_API_KEY  [REQUIRED]" \
    "Get from resend.com → API Keys" "" secret
  set_val RESEND_API_KEY "$REPLY_VAL"; ((ASKED++))
else
  skip "RESEND_API_KEY (already set)"
fi

val=$(get_val RESEND_FROM_EMAIL)
if is_missing "$val"; then
  prompt "RESEND_FROM_EMAIL" \
    "Domain must be verified in Resend — e.g. AmroGen <noreply@yourdomain.com>"
  set_val RESEND_FROM_EMAIL "$REPLY_VAL"; ((ASKED++))
else
  skip "RESEND_FROM_EMAIL ($val)"
fi

val=$(get_val ARTICLE_NOTIFY_FROM)
if is_missing "$val"; then
  prompt "ARTICLE_NOTIFY_FROM" "From address for admin article alerts"
  [[ -n "$REPLY_VAL" ]] && { set_val ARTICLE_NOTIFY_FROM "$REPLY_VAL"; ((ASKED++)); }
else
  skip "ARTICLE_NOTIFY_FROM ($val)"
fi

# ════════════════════════════════════════════════════════════════════════════
header "6 · Stripe (Payments)"

for key in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_STARTER STRIPE_PRICE_GROWTH STRIPE_PRICE_SCALE; do
  val=$(get_val "$key")
  if is_missing "$val"; then
    case "$key" in
      STRIPE_SECRET_KEY)       prompt "$key" "sk_live_... from Stripe Dashboard → API Keys (Enter to skip)" "" secret ;;
      STRIPE_WEBHOOK_SECRET)   prompt "$key" "whsec_... from Stripe Dashboard → Webhooks (Enter to skip)" "" secret ;;
      STRIPE_PRICE_STARTER)    prompt "$key" "price_... Starter tier (Enter to skip)" ;;
      STRIPE_PRICE_GROWTH)     prompt "$key" "price_... Growth tier (Enter to skip)" ;;
      STRIPE_PRICE_SCALE)      prompt "$key" "price_... Scale tier (Enter to skip)" ;;
    esac
    [[ -n "$REPLY_VAL" ]] && { set_val "$key" "$REPLY_VAL"; ((ASKED++)); }
  else
    skip "$key (already set)"
  fi
done

# ════════════════════════════════════════════════════════════════════════════
header "7 · Google Services"

val=$(get_val GOOGLE_CLIENT_ID)
if is_missing "$val"; then
  prompt "GOOGLE_CLIENT_ID" "e.g. 12345-abc.apps.googleusercontent.com (Enter to skip)"
  [[ -n "$REPLY_VAL" ]] && { set_val GOOGLE_CLIENT_ID "$REPLY_VAL"; ((ASKED++)); }
else
  skip "GOOGLE_CLIENT_ID ($val)"
fi

val=$(get_val GOOGLE_CLIENT_SECRET)
if is_missing "$val"; then
  prompt "GOOGLE_CLIENT_SECRET" "GOCSPX-... (Enter to skip)" "" secret
  [[ -n "$REPLY_VAL" ]] && { set_val GOOGLE_CLIENT_SECRET "$REPLY_VAL"; ((ASKED++)); }
else
  skip "GOOGLE_CLIENT_SECRET (already set)"
fi

val=$(get_val GCS_BUCKET_NAME)
if is_missing "$val"; then
  prompt "GCS_BUCKET_NAME" "Bucket for campaign files" "amrogen-campaigns"
  set_val GCS_BUCKET_NAME "$REPLY_VAL"; ((ASKED++))
else
  skip "GCS_BUCKET_NAME ($val)"
fi

# GCS key file
if [[ ! -f "$GCS_KEY_DEST" ]]; then
  echo ""
  label "GCP Service Account JSON key file"
  hint "IAM → Service Accounts → Create → Download JSON key"
  hint "Path to the downloaded .json file (Enter to skip)"
  echo -ne "  → "
  read -r GCS_KEY_PATH
  if [[ -n "$GCS_KEY_PATH" && -f "$GCS_KEY_PATH" ]]; then
    mkdir -p "$(dirname "$GCS_KEY_DEST")"
    cp "$GCS_KEY_PATH" "$GCS_KEY_DEST"
    ok "Copied to backend/secrets/gcp-key.json"
    set_val GOOGLE_APPLICATION_CREDENTIALS "/secrets/gcp-key.json"
    set_val STORAGE_BACKEND "gcs"
    ((ASKED++))
  elif [[ -n "$GCS_KEY_PATH" ]]; then
    warn "File not found — GCS uploads will fall back to local storage"
    set_val STORAGE_BACKEND "local"
  else
    set_val STORAGE_BACKEND "local"
  fi
else
  skip "GCS key (backend/secrets/gcp-key.json already present)"
fi

val=$(get_val GEMINI_API_KEY)
if is_missing "$val"; then
  prompt "GEMINI_API_KEY" "AIza... from aistudio.google.com/apikey (Enter to skip)" "" secret
  [[ -n "$REPLY_VAL" ]] && { set_val GEMINI_API_KEY "$REPLY_VAL"; ((ASKED++)); }
else
  skip "GEMINI_API_KEY (already set)"
fi

val=$(get_val OPENAI_API_KEY)
if is_missing "$val"; then
  prompt "OPENAI_API_KEY" "sk-proj-... from platform.openai.com/api-keys (Enter to skip)" "" secret
  [[ -n "$REPLY_VAL" ]] && { set_val OPENAI_API_KEY "$REPLY_VAL"; ((ASKED++)); }
else
  skip "OPENAI_API_KEY (already set)"
fi

# Write model defaults if absent
for kv in \
  "GEMINI_TTS_MODEL:gemini-2.5-pro-preview-tts" \
  "GEMINI_ASSISTANT_MODEL:gemini-3.1-pro-preview" \
  "GEMINI_ARTICLE_MODEL:gemini-3.1-pro-preview" \
  "GEMINI_ARTICLE_TTS_MODEL:gemini-2.5-pro-preview-tts" \
  "GEMINI_ARTICLE_TTS_VOICE:Leda" \
  "OPENAI_IMAGE_MODEL:gpt-image-2" \
  "OPENAI_IMAGE_SIZE:1536x1024" \
  "ENVIRONMENT:production" \
  "JWT_EXPIRY_DAYS:7"
do
  k="${kv%%:*}"; v="${kv#*:}"
  [[ -z "$(get_val "$k")" ]] && set_val "$k" "$v"
done

# ════════════════════════════════════════════════════════════════════════════
header "Summary"

GCP_PROJECT_ID=$(get_val GCP_PROJECT_ID)
GCP_REGION=$(get_val GCP_REGION)
DB=$(get_val DATABASE_URL | sed 's|://[^@]*@|://***@|')

echo ""
if [[ "$ASKED" -eq 0 ]]; then
  ok ".env was already complete — nothing needed to be filled in."
else
  ok "$ASKED value(s) updated in .env"
fi
echo ""
echo -e "  • GCP Project: ${TEAL}$GCP_PROJECT_ID${RESET} (${GCP_REGION})"
echo -e "  • Database:    ${DIM}$DB${RESET}"
echo -e "  • Anthropic:   $([ -n "$(get_val ANTHROPIC_API_KEY)" ] && echo "${GREEN}✓${RESET}" || echo "${RED}✗ missing${RESET}")"
echo -e "  • Resend:      $([ -n "$(get_val RESEND_API_KEY)" ] && echo "${GREEN}✓${RESET}" || echo "${RED}✗ missing${RESET}")"
echo -e "  • Stripe:      $([ -n "$(get_val STRIPE_SECRET_KEY)" ] && echo "${GREEN}✓${RESET}" || echo "${YELLOW}skipped${RESET}")"
echo -e "  • Gmail OAuth: $([ -n "$(get_val GOOGLE_CLIENT_ID)" ] && echo "${GREEN}✓${RESET}" || echo "${YELLOW}skipped${RESET}")"
echo -e "  • GCS key:     $([ -f "$GCS_KEY_DEST" ] && echo "${GREEN}✓${RESET}" || echo "${YELLOW}skipped (local storage)${RESET}")"
echo -e "  • Gemini:      $([ -n "$(get_val GEMINI_API_KEY)" ] && echo "${GREEN}✓${RESET}" || echo "${YELLOW}skipped${RESET}")"
echo -e "  • OpenAI:      $([ -n "$(get_val OPENAI_API_KEY)" ] && echo "${GREEN}✓${RESET}" || echo "${YELLOW}skipped${RESET}")"

# ════════════════════════════════════════════════════════════════════════════
header "Deploy to GCP"

echo ""
echo -e "  ${BOLD}Ready to deploy to Google Cloud Run.${RESET}"
echo -e "  ${DIM}Builds Docker images → deploys API/Worker/Beat/MCP/Frontend → runs migrations${RESET}"
echo -e "  ${DIM}Takes ~10-15 minutes${RESET}"
echo ""
read -rp "  Start deployment now? [Y/n] " DEPLOY_NOW
DEPLOY_NOW="${DEPLOY_NOW:-Y}"

if [[ "$DEPLOY_NOW" =~ ^[Yy]$ ]]; then
  echo ""
  ok "Starting deployment…"
  echo ""
  export GCP_PROJECT_ID
  export GCP_REGION
  bash "$SCRIPT_DIR/deploy.sh"
else
  echo ""
  warn "Deployment skipped. Run it later with:"
  echo -e "  ${BOLD}./deploy.sh${RESET}"
  echo ""
fi
