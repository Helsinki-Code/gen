from __future__ import annotations

from app.config import get_settings

_s = get_settings()

# ── Existing agents ───────────────────────────────────────────────────────────
LEAD_AGENT_ID       = _s.lead_agent_id
LEAD_AGENT_VERSION  = _s.lead_agent_version
LEAD_ENV_ID         = _s.lead_env_id

OUTREACH_AGENT_ID       = _s.outreach_agent_id
OUTREACH_AGENT_VERSION  = _s.outreach_agent_version
OUTREACH_ENV_ID         = _s.outreach_env_id

VAULT_IDS         = _s.vault_ids_list
ANTHROPIC_API_KEY = _s.anthropic_api_key

# ── New specialist agents ─────────────────────────────────────────────────────
EMAIL_AGENT_ID       = _s.email_agent_id
EMAIL_AGENT_VERSION  = _s.email_agent_version
EMAIL_ENV_ID         = _s.email_env_id

SMS_AGENT_ID       = _s.sms_agent_id
SMS_AGENT_VERSION  = _s.sms_agent_version
SMS_ENV_ID         = _s.sms_env_id

REPLY_MONITOR_AGENT_ID       = _s.reply_monitor_agent_id
REPLY_MONITOR_AGENT_VERSION  = _s.reply_monitor_agent_version
REPLY_MONITOR_ENV_ID         = _s.reply_monitor_env_id

ORCHESTRATOR_AGENT_ID       = _s.orchestrator_agent_id
ORCHESTRATOR_AGENT_VERSION  = _s.orchestrator_agent_version
ORCHESTRATOR_ENV_ID         = _s.orchestrator_env_id
