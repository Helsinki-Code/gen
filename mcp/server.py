"""
AmroGen MCP Server
==================
Exposes the AmroGen B2B outreach platform as an MCP tool suite.

Transport : Streamable HTTP (SSE) — port 8001
Auth      : Set AMROGEN_API_KEY env var to an `amro_sk_...` key from
            the AmroGen dashboard (Settings → API Keys).

Tool groups
-----------
  Campaigns  — create, list, get, approve, send
  Leads      — list enriched leads per campaign
  Sequences  — list and update outreach sequences
  Credits    — balance, transaction history, purchase
  Gmail      — connection status and OAuth flow
  API Keys   — list, create, revoke
"""

import json
import os
from typing import Any, Optional

import httpx
from fastmcp import FastMCP

# ── Constants ────────────────────────────────────────────────────────────────

BACKEND_URL: str = os.environ.get("BACKEND_API_URL", "http://localhost:8000")
DEFAULT_API_KEY: str = os.environ.get("AMROGEN_API_KEY", "")
TIMEOUT: float = 300.0  # AI pipeline calls can take 3–8 minutes

# ── Server init ──────────────────────────────────────────────────────────────

mcp = FastMCP(
    name="amrogen_mcp",
    description=(
        "AmroGen — AI-powered B2B lead generation and multi-channel outreach automation. "
        "Point it at any company website to discover decision-makers and generate "
        "hyper-personalised email, LinkedIn, and SMS sequences in minutes."
    ),
)

# ── Shared HTTP client ────────────────────────────────────────────────────────


async def _request(
    method: str,
    path: str,
    json_body: Optional[dict] = None,
    params: Optional[dict] = None,
) -> Any:
    """Central async HTTP helper — all tools route through here."""
    key = DEFAULT_API_KEY
    if not key:
        raise RuntimeError(
            "No API key configured. Set the AMROGEN_API_KEY environment variable "
            "to an `amro_sk_...` key from the AmroGen dashboard (Settings → API Keys)."
        )

    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    clean_params = {k: v for k, v in (params or {}).items() if v is not None}

    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=TIMEOUT) as client:
        try:
            response = await getattr(client, method)(
                path, headers=headers, json=json_body, params=clean_params
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            try:
                detail = exc.response.json().get("detail", exc.response.text)
            except Exception:
                detail = exc.response.text
            if status == 401:
                raise RuntimeError(
                    "Authentication failed. Check that AMROGEN_API_KEY is valid "
                    "and has not been revoked."
                ) from exc
            if status == 402:
                raise RuntimeError(
                    f"Insufficient credits — {detail}. "
                    "Use amrogen_get_balance to check your balance, or "
                    "amrogen_purchase_credits to top up."
                ) from exc
            if status == 404:
                raise RuntimeError(
                    f"Resource not found: {detail}. "
                    "Double-check the ID and ensure it belongs to your account."
                ) from exc
            if status == 429:
                raise RuntimeError("Rate limit exceeded. Please wait before retrying.") from exc
            raise RuntimeError(f"API error {status}: {detail}") from exc
        except httpx.TimeoutException:
            raise RuntimeError(
                "Request timed out. The pipeline can take 3–8 minutes — "
                "use amrogen_get_campaign to poll progress instead."
            )

    return response.json()


# ── Formatting helpers ────────────────────────────────────────────────────────

_STATUS_EMOJI = {
    "queued": "⏳", "generating_leads": "🔍", "leads_ready": "📋",
    "generating_sequences": "✍️", "review": "👁️", "approved": "✅",
    "sending": "📤", "complete": "🎉", "failed": "❌",
}


def _fmt_campaign(c: dict) -> str:
    emoji = _STATUS_EMOJI.get(c.get("status", ""), "•")
    lines = [
        f"### {emoji} Campaign `{c.get('id', '?')}`",
        f"- **URL**: {c.get('target_url', '—')}",
        f"- **Status**: {c.get('status', '—')}",
        f"- **Leads requested**: {c.get('leads_requested', '—')}",
        f"- **Leads found**: {c.get('leads_count', '—')}",
        f"- **Sequences**: {c.get('sequences_count', '—')}",
        f"- **Credits charged**: {c.get('credits_charged', '—')}",
        f"- **Created**: {c.get('created_at', '—')}",
    ]
    if c.get("error_message"):
        lines.append(f"- **Error**: {c['error_message']}")
    if c.get("files"):
        file_list = ", ".join(f.get("file_type", "") for f in c["files"])
        lines.append(f"- **Files**: {file_list}")
    return "\n".join(lines)


def _fmt_lead(lead: dict, index: Optional[int] = None) -> str:
    prefix = f"{index}. " if index is not None else "- "
    return (
        f"{prefix}**{lead.get('name', 'Unknown')}** — "
        f"{lead.get('title', '')} @ {lead.get('company', '')}\n"
        f"   Email: {lead.get('email', '—')} | LinkedIn: {lead.get('linkedin_url', '—')}\n"
        f"   Phone: {lead.get('phone', '—')} | ICP Score: {lead.get('icp_fit_score', '—')}"
    )


def _fmt_sequence(seq: dict) -> str:
    lead = seq.get("lead") or {}
    channels = ", ".join(seq.get("channels") or []) or "—"
    lines = [
        f"#### Sequence `{seq.get('id', '?')}`",
        f"- **Lead**: {lead.get('name', '?')} — {lead.get('title', '')} @ {lead.get('company', '')}",
        f"- **Status**: {seq.get('status', '—')} | **Channels**: {channels}",
    ]
    for step in seq.get("steps") or []:
        subj = f" — {step['subject']}" if step.get("subject") else ""
        lines.append(
            f"  - Step {step.get('step_number')} · Day {step.get('day')} · "
            f"{step.get('channel', '').upper()} · {step.get('type', '')}{subj}"
        )
    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
# CAMPAIGN TOOLS
# ══════════════════════════════════════════════════════════════════════════════


@mcp.tool(
    name="amrogen_create_campaign",
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": True},
)
async def amrogen_create_campaign(
    target_url: str,
    leads_requested: int = 25,
    batch_size: int = 5,
) -> str:
    """
    Launch a new AmroGen AI pipeline: lead generation + outreach sequence generation.

    Runs four phases automatically:
      1. Lead Generator discovers and enriches B2B decision-makers from the target website.
      2. Orchestrator routes each lead to the right specialist agents.
      3. Specialist agents (Email, Outreach, SMS) write personalised multi-channel sequences.
      4. Orchestrator quality-reviews output (score 1–10, retries up to 3×).

    Credits are deducted upfront (8 credits per 10 leads). Pipeline takes 3–8 minutes.
    Poll progress with amrogen_get_campaign.

    Args:
        target_url: Full URL of the target company website (e.g. https://acme.com).
        leads_requested: Number of leads to discover and enrich. Range 10–100. Default 25.
        batch_size: Leads per agent batch. Range 1–10. Default 5.

    Returns:
        Campaign ID, status, and estimated credit cost.
    """
    if not target_url.startswith(("http://", "https://")):
        return "Error: target_url must start with http:// or https://"
    if not (10 <= leads_requested <= 100):
        return "Error: leads_requested must be between 10 and 100."
    if not (1 <= batch_size <= 10):
        return "Error: batch_size must be between 1 and 10."

    credits_estimate = (leads_requested // 10) * 8
    result = await _request(
        "post",
        "/campaigns",
        json_body={"target_url": target_url, "leads_requested": leads_requested, "batch_size": batch_size},
    )
    return (
        f"## ✅ Campaign created\n\n"
        f"{_fmt_campaign(result)}\n\n"
        f"**Estimated cost**: ~{credits_estimate} credits\n\n"
        f"Pipeline is running. Poll with `amrogen_get_campaign(campaign_id='{result['id']}')`."
    )


@mcp.tool(
    name="amrogen_list_campaigns",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
)
async def amrogen_list_campaigns(
    page: int = 1,
    per_page: int = 20,
    response_format: str = "markdown",
) -> str:
    """
    Return a paginated list of the account's AmroGen campaigns, newest first.

    Args:
        page: Page number (1-based). Default 1.
        per_page: Results per page (1–100). Default 20.
        response_format: 'markdown' for readable output, 'json' for raw data.

    Returns:
        List of campaigns with status, URL, lead count, and credit cost.
    """
    result = await _request("get", "/campaigns", params={"page": page, "per_page": per_page})
    campaigns: list = result if isinstance(result, list) else []

    if response_format == "json":
        return json.dumps(campaigns, indent=2, default=str)

    if not campaigns:
        return "No campaigns found. Create one with `amrogen_create_campaign`."

    lines = [f"## Campaigns (page {page}, {len(campaigns)} results)\n"]
    for c in campaigns:
        lines.append(_fmt_campaign(c))
        lines.append("")
    return "\n".join(lines)


@mcp.tool(
    name="amrogen_get_campaign",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
)
async def amrogen_get_campaign(
    campaign_id: str,
    response_format: str = "markdown",
) -> str:
    """
    Fetch full details of a single campaign, including pipeline status, lead count,
    sequence count, credits charged, and downloadable file references.

    Use this to poll pipeline progress after creating a campaign.

    Status progression: queued → generating_leads → leads_ready →
    generating_sequences → review → approved → sending → complete / failed

    Args:
        campaign_id: UUID of the campaign (e.g. '3fa85f64-5717-4562-b3fc-2c963f66afa6').
        response_format: 'markdown' for readable output, 'json' for raw data.

    Returns:
        Campaign details with status, counts, files, and next-step hints.
    """
    result = await _request("get", f"/campaigns/{campaign_id}")

    if response_format == "json":
        return json.dumps(result, indent=2, default=str)

    status = result.get("status", "")
    hint_map = {
        "generating_leads": "\n\n⏳ Still finding leads — poll again in 30–60 seconds.",
        "generating_sequences": "\n\n⏳ Agents writing sequences — poll again in 30–60 seconds.",
        "queued": "\n\n⏳ Waiting to start — poll again shortly.",
        "review": (
            "\n\n👁️ Sequences ready for review. "
            "Use `amrogen_get_sequences` to inspect, then "
            "`amrogen_approve_all_sequences` or `amrogen_update_sequence` per lead."
        ),
        "approved": "\n\n✅ Approved. Use `amrogen_send_campaign` to start sending.",
        "failed": "\n\n❌ Pipeline failed. See error_message above for details.",
    }
    hint = hint_map.get(status, "")
    return f"{_fmt_campaign(result)}{hint}"


@mcp.tool(
    name="amrogen_approve_all_sequences",
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
)
async def amrogen_approve_all_sequences(campaign_id: str) -> str:
    """
    Approve every pending outreach sequence in a campaign in one action.
    Schedules all email steps based on their day offsets from now.

    The campaign must be in 'review' status. After approval, use
    amrogen_send_campaign to start dispatching messages.

    Args:
        campaign_id: UUID of the campaign in 'review' status.

    Returns:
        Confirmation with count of approved sequences.
    """
    result = await _request("post", f"/campaigns/{campaign_id}/approve-all")
    approved = result.get("approved", 0)
    return (
        f"## ✅ {approved} sequence(s) approved\n\n"
        f"Campaign `{campaign_id}` is now in 'approved' status.\n"
        f"Next: call `amrogen_send_campaign(campaign_id='{campaign_id}')` to launch sending."
    )


@mcp.tool(
    name="amrogen_send_campaign",
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": True},
)
async def amrogen_send_campaign(
    campaign_id: str,
    sender_name: str = "",
) -> str:
    """
    Start dispatching approved outreach sequences. Email steps send from the user's
    connected Gmail account on their scheduled day offsets. LinkedIn steps are added
    to a copy queue — they do not auto-post.

    Prerequisites:
      - Campaign must be in 'approved' status.
      - Gmail must be connected (check with amrogen_gmail_status).

    Args:
        campaign_id: UUID of the campaign in 'approved' status.
        sender_name: Your name to replace '[Seller Name]' placeholders in all messages.
                     Example: 'Alex Johnson'. Leave empty to keep the placeholder.

    Returns:
        Confirmation that sending has started.
    """
    params = {"sender_name": sender_name} if sender_name else None
    result = await _request("post", f"/campaigns/{campaign_id}/send", params=params)
    return (
        f"## 📤 Campaign launched\n\n"
        f"{result.get('message', 'Sending started.')}\n\n"
        f"Email steps dispatch automatically on scheduled days. "
        f"LinkedIn steps appear in your copy queue. "
        f"Track with `amrogen_get_campaign(campaign_id='{campaign_id}')`."
    )


# ══════════════════════════════════════════════════════════════════════════════
# LEAD TOOLS
# ══════════════════════════════════════════════════════════════════════════════


@mcp.tool(
    name="amrogen_get_leads",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
)
async def amrogen_get_leads(
    campaign_id: str,
    icp_filter: str = "",
    response_format: str = "markdown",
) -> str:
    """
    Return the enriched leads discovered by the Lead Generator agent.
    Each lead includes name, title, company, email, LinkedIn URL, phone,
    location, and ICP fit score.

    The campaign must be past the 'generating_leads' phase.

    Args:
        campaign_id: UUID of the campaign.
        icp_filter: Optional keyword to filter by ICP score (e.g. 'High', 'Medium').
                    Case-insensitive partial match.
        response_format: 'markdown' for readable output, 'json' for raw data.

    Returns:
        Numbered list of enriched leads with all contact details and ICP scores.
    """
    result = await _request("get", f"/campaigns/{campaign_id}/leads")
    leads: list = result if isinstance(result, list) else []

    if icp_filter:
        f_lower = icp_filter.lower()
        leads = [l for l in leads if f_lower in (l.get("icp_fit_score") or "").lower()]

    if response_format == "json":
        return json.dumps(leads, indent=2, default=str)

    if not leads:
        filter_note = f" matching ICP filter '{icp_filter}'" if icp_filter else ""
        return (
            f"No leads found{filter_note}. "
            "The pipeline may still be running, or the filter returned no matches."
        )

    lines = [f"## Leads for campaign `{campaign_id}` ({len(leads)} total)\n"]
    for i, lead in enumerate(leads, 1):
        lines.append(_fmt_lead(lead, index=i))
        lines.append("")
    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
# SEQUENCE TOOLS
# ══════════════════════════════════════════════════════════════════════════════


@mcp.tool(
    name="amrogen_get_sequences",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
)
async def amrogen_get_sequences(
    campaign_id: str,
    status_filter: str = "",
    response_format: str = "markdown",
) -> str:
    """
    Return all outreach sequences for a campaign with full step-level content:
    day, channel (email/linkedin/sms), type, subject, and message body per step.

    The campaign must be in 'review' or later status.

    Args:
        campaign_id: UUID of the campaign.
        status_filter: Optional filter by sequence status.
                       Valid values: 'pending', 'approved', 'paused', 'stopped'.
        response_format: 'markdown' for readable output, 'json' for full raw data.

    Returns:
        Per-lead sequences with all step content and scheduling info.
    """
    result = await _request("get", f"/campaigns/{campaign_id}/sequences")
    sequences: list = result if isinstance(result, list) else []

    if status_filter:
        sequences = [s for s in sequences if s.get("status") == status_filter]

    if response_format == "json":
        return json.dumps(sequences, indent=2, default=str)

    if not sequences:
        note = f" with status '{status_filter}'" if status_filter else ""
        return (
            f"No sequences found{note}. "
            "The pipeline may still be running, or the status filter returned nothing."
        )

    lines = [f"## Sequences for campaign `{campaign_id}` ({len(sequences)} total)\n"]
    for seq in sequences:
        lines.append(_fmt_sequence(seq))
        lines.append("")
    return "\n".join(lines)


@mcp.tool(
    name="amrogen_update_sequence",
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
)
async def amrogen_update_sequence(
    campaign_id: str,
    sequence_id: str,
    status: str,
) -> str:
    """
    Update the status of a single outreach sequence for a specific lead.
    Use this to approve, pause, or stop individual sequences during review.

    To approve all sequences at once, use amrogen_approve_all_sequences instead.

    Args:
        campaign_id: UUID of the campaign the sequence belongs to.
        sequence_id: UUID of the sequence to update. Get this from amrogen_get_sequences.
        status: New status. Must be one of: 'approved', 'paused', 'stopped'.

    Returns:
        Updated sequence details with new status.
    """
    if status not in ("approved", "paused", "stopped"):
        return "Error: status must be one of: 'approved', 'paused', 'stopped'."

    result = await _request(
        "put",
        f"/campaigns/{campaign_id}/sequences/{sequence_id}",
        json_body={"status": status},
    )
    lead = result.get("lead") or {}
    return (
        f"## Sequence updated\n\n"
        f"- **Lead**: {lead.get('name', '?')} — {lead.get('title', '')} @ {lead.get('company', '')}\n"
        f"- **Status**: {result.get('status', '—')}\n"
        f"- **Sequence ID**: `{result.get('id', sequence_id)}`"
    )


# ══════════════════════════════════════════════════════════════════════════════
# CREDITS TOOLS
# ══════════════════════════════════════════════════════════════════════════════


@mcp.tool(
    name="amrogen_get_balance",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
)
async def amrogen_get_balance(
    include_transactions: bool = True,
    response_format: str = "markdown",
) -> str:
    """
    Return the current credit balance and transaction history for the account.

    Credits are spent when creating campaigns (8 credits per 10 leads requested).
    Transaction history shows each pipeline run and any top-ups.

    Args:
        include_transactions: Whether to include transaction history. Default True.
        response_format: 'markdown' for readable output, 'json' for raw data.

    Returns:
        Current balance and, optionally, a list of past transactions with
        amounts, descriptions, and timestamps.
    """
    result = await _request("get", "/credits/balance")

    if response_format == "json":
        if not include_transactions:
            result.pop("transactions", None)
        return json.dumps(result, indent=2, default=str)

    balance = result.get("balance", 0)
    lines = [f"## Credits balance: **{balance} credits**\n"]

    if include_transactions:
        txs: list = result.get("transactions", [])
        if txs:
            lines.append("### Transaction history\n")
            for tx in txs[:20]:
                sign = "+" if tx.get("amount", 0) > 0 else ""
                lines.append(
                    f"- {sign}{tx.get('amount', 0)} credits — "
                    f"{tx.get('description', '—')} ({tx.get('created_at', '—')})"
                )
        else:
            lines.append("_No transactions yet._")

    return "\n".join(lines)


@mcp.tool(
    name="amrogen_purchase_credits",
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": True},
)
async def amrogen_purchase_credits(plan: str) -> str:
    """
    Create a Stripe checkout session to purchase additional AmroGen credits.
    Returns a URL the user must open in a browser to complete payment.

    Plans:
      - starter: 100 credits — good for ~12 pipeline runs at 25 leads
      - growth:  500 credits — good for ~62 pipeline runs
      - scale:  2000 credits — good for ~250 pipeline runs

    Args:
        plan: Credit plan. Must be one of: 'starter', 'growth', 'scale'.

    Returns:
        Stripe checkout URL to open in a browser.
    """
    plan_credits = {"starter": 100, "growth": 500, "scale": 2000}
    if plan not in plan_credits:
        return "Error: plan must be one of: 'starter', 'growth', 'scale'."

    result = await _request("post", "/credits/purchase", json_body={"plan": plan})
    checkout_url = result.get("checkout_url", "")
    credits = plan_credits[plan]
    return (
        f"## 💳 Checkout ready — {plan} plan ({credits} credits)\n\n"
        f"Open this URL in your browser to complete payment:\n\n"
        f"{checkout_url}\n\n"
        f"Credits are added to your account immediately after payment."
    )


# ══════════════════════════════════════════════════════════════════════════════
# GMAIL TOOLS
# ══════════════════════════════════════════════════════════════════════════════


@mcp.tool(
    name="amrogen_gmail_status",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
)
async def amrogen_gmail_status() -> str:
    """
    Check whether a Gmail account is connected to this AmroGen account.
    Gmail must be connected before campaigns can send email sequences.

    Returns:
        Gmail connection status and the connected email address (if connected).
    """
    result = await _request("get", "/gmail/status")
    connected = result.get("connected", False)
    email = result.get("gmail_email", "")

    if connected:
        return (
            f"## ✅ Gmail connected\n\n"
            f"**Account**: {email}\n\n"
            f"Email sequences will send from this address when a campaign launches."
        )
    return (
        "## ⚠️ Gmail not connected\n\n"
        "Email sequences cannot send until Gmail is connected.\n\n"
        "Use `amrogen_get_gmail_auth_url` to get the OAuth link, "
        "then open it in your browser to authorise AmroGen."
    )


@mcp.tool(
    name="amrogen_get_gmail_auth_url",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": True},
)
async def amrogen_get_gmail_auth_url() -> str:
    """
    Generate a Gmail OAuth 2.0 authorization URL. Open this URL in a browser
    to connect your Google account so AmroGen can send email sequences.

    Returns:
        Google OAuth URL to open in a browser.
    """
    result = await _request("get", "/gmail/auth-url")
    auth_url = result.get("auth_url", "")
    return (
        f"## Gmail OAuth URL\n\n"
        f"Open this URL in your browser to connect Gmail:\n\n"
        f"{auth_url}\n\n"
        f"After authorising, AmroGen can send email sequences from your inbox."
    )


# ══════════════════════════════════════════════════════════════════════════════
# API KEY TOOLS
# ══════════════════════════════════════════════════════════════════════════════


@mcp.tool(
    name="amrogen_list_api_keys",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
)
async def amrogen_list_api_keys(response_format: str = "markdown") -> str:
    """
    List all active AmroGen API keys for the account.
    Full key values are never returned after creation — only prefixes are shown.

    Args:
        response_format: 'markdown' for readable output, 'json' for raw data.

    Returns:
        List of API keys with name, prefix, creation date, and last-used date.
    """
    result = await _request("get", "/api-keys")
    keys: list = result if isinstance(result, list) else []

    if response_format == "json":
        return json.dumps(keys, indent=2, default=str)

    if not keys:
        return "No API keys found. Create one with `amrogen_create_api_key`."

    lines = [f"## API keys ({len(keys)} total)\n"]
    for k in keys:
        last_used = k.get("last_used_at") or "never"
        lines.append(
            f"- **{k.get('name', '—')}** `{k.get('key_prefix', '')}...`"
            f" | ID: `{k.get('id', '')}` | Created: {k.get('created_at', '—')} | Last used: {last_used}"
        )
    return "\n".join(lines)


@mcp.tool(
    name="amrogen_create_api_key",
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False},
)
async def amrogen_create_api_key(name: str) -> str:
    """
    Create a new AmroGen API key. The full key is returned ONLY ONCE at creation —
    save it immediately. Future calls will only show the key prefix.

    Args:
        name: Human-readable label for the key (e.g. 'Claude integration', 'CI pipeline').

    Returns:
        The full API key (store now), key ID for future revocation, and prefix.
    """
    if not name.strip():
        return "Error: name cannot be empty."

    result = await _request("post", "/api-keys", json_body={"name": name})
    full_key = result.get("full_key", "")
    return (
        f"## 🔑 API key created — save this now!\n\n"
        f"**Name**: {result.get('name', name)}\n"
        f"**Key ID**: `{result.get('id', '—')}`\n"
        f"**Full key (shown once only)**:\n\n"
        f"```\n{full_key}\n```\n\n"
        f"Set `AMROGEN_API_KEY={full_key}` in your environment to use this key."
    )


@mcp.tool(
    name="amrogen_revoke_api_key",
    annotations={"readOnlyHint": False, "destructiveHint": True, "idempotentHint": True, "openWorldHint": False},
)
async def amrogen_revoke_api_key(key_id: str) -> str:
    """
    Permanently revoke an AmroGen API key. All requests using this key will
    immediately return 401 Unauthorized. This action cannot be undone.

    Args:
        key_id: UUID of the API key to revoke. Get this from amrogen_list_api_keys.

    Returns:
        Confirmation that the key has been permanently disabled.
    """
    await _request("delete", f"/api-keys/{key_id}")
    return (
        f"## 🗑️ API key revoked\n\n"
        f"Key `{key_id}` is permanently disabled. "
        f"Any service using it will receive 401 Unauthorized immediately."
    )


# ══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "8001"))
    mcp.run(transport="sse", host="0.0.0.0", port=port)
