"""
Campaign Orchestrator Agent — analyses leads and produces a per-lead campaign plan,
then routes each lead to the right specialist agents.
Reads config from agents/config.py (Settings → .env).
"""
from __future__ import annotations

import json
import re
from typing import Callable, Optional

import anthropic

from agents.config import ANTHROPIC_API_KEY, ORCHESTRATOR_AGENT_ID, ORCHESTRATOR_AGENT_VERSION, ORCHESTRATOR_ENV_ID


def _rows_to_csv(rows: list[dict]) -> str:
    if not rows:
        return ""
    headers = list(rows[0].keys())
    lines = [",".join(headers)]
    for row in rows:
        lines.append(
            ",".join(f'"{(str(row.get(h, "") or "")).replace(chr(34), chr(39))}"' for h in headers)
        )
    return "\n".join(lines)


def _parse_plan(raw: str) -> list[dict]:
    clean = raw.strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```[a-z]*\n?", "", clean)
        clean = re.sub(r"\n?```$", "", clean.strip())
    try:
        result = json.loads(clean)
        return result if isinstance(result, list) else [result]
    except json.JSONDecodeError as e:
        return []


def build_campaign_plan(
    leads: list[dict],
    seller_context: str = "",
    progress_cb: Optional[Callable[[str, dict], None]] = None,
) -> list[dict]:
    """
    Ask the Orchestrator Agent to analyse every lead and return a campaign plan
    specifying which specialist agents to invoke per lead.
    """
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def publish(t: str, d: dict = {}) -> None:
        if progress_cb:
            progress_cb(t, d)

    parts = []
    if seller_context:
        parts.append(f"SELLER CONTEXT:\n{seller_context[:3000]}")
    csv_text = _rows_to_csv(leads)
    parts.append(
        f"LEADS ({len(leads)} total):\n```csv\n{csv_text}\n```\n\n"
        f"Analyse every lead and produce the campaign plan JSON as per your instructions."
    )
    prompt = "\n\n".join(parts)

    agent_ref = {"type": "agent", "id": ORCHESTRATOR_AGENT_ID, "version": ORCHESTRATOR_AGENT_VERSION}
    session = client.beta.sessions.create(
        agent=agent_ref,
        environment_id=ORCHESTRATOR_ENV_ID,
        extra_body={"title": f"Campaign plan — {len(leads)} leads"},
    )
    publish("orchestrator_start", {"leads": len(leads)})

    full_text = ""
    with client.beta.sessions.events.stream(session_id=session.id) as stream:
        client.beta.sessions.events.send(
            session_id=session.id,
            events=[{"type": "user.message", "content": [{"type": "text", "text": prompt}]}],
        )
        for event in stream:
            if event.type == "agent.message":
                for block in event.content:
                    if block.type == "text":
                        full_text += block.text
                        publish("orchestrator_text", {"text": block.text})
            elif event.type == "session.status_idle":
                stop = getattr(event, "stop_reason", None)
                if stop and getattr(stop, "type", None) == "requires_action":
                    continue
                break
            elif event.type == "session.status_terminated":
                break

    plan = _parse_plan(full_text)
    publish("orchestrator_plan_ready", {"leads_planned": len(plan)})
    return plan


def segregate_leads(plan: list[dict], leads: list[dict]) -> dict:
    """
    Map each specialist agent to the leads it should process, based on the orchestrator's plan.
    Returns {"email": [...], "sms": [...], "outreach": [...]}.
    """
    lead_map = {(l.get("Name") or l.get("name") or "").lower(): l for l in leads}
    email_leads, sms_leads, outreach_leads = [], [], []

    for item in plan:
        name = (item.get("lead_name") or "").lower()
        lead = lead_map.get(name) or next(
            (l for l in leads if (l.get("Name") or l.get("name") or "").lower() == name),
            None,
        )
        if not lead:
            continue

        agents = item.get("agents_to_invoke", [])
        lead_with_meta = {**lead, "_messaging_angle": item.get("messaging_angle", ""), "_plan": item}

        if "outreach_agent" in agents:
            outreach_leads.append(lead_with_meta)
        if "email_agent" in agents:
            email_leads.append(lead_with_meta)
        if "sms_agent" in agents:
            sms_leads.append(lead_with_meta)
        if not agents:
            outreach_leads.append(lead_with_meta)

    return {"email": email_leads, "sms": sms_leads, "outreach": outreach_leads}


def review_agent_output(
    agent_name: str,
    leads_count: int,
    sequences: list[dict],
    attempt: int = 1,
    progress_cb: Optional[Callable[[str, dict], None]] = None,
) -> dict:
    """
    Use Claude directly to review a specialist agent's output.
    Returns {decision: "ACCEPT"|"REJECT", score: 1-10, feedback: "...", issues: [...]}.
    Max 3 attempts before auto-accepting.
    """
    import anthropic as _anthropic
    from agents.config import ANTHROPIC_API_KEY

    def publish(t: str, d: dict = {}) -> None:
        if progress_cb:
            progress_cb(t, d)

    if attempt >= 3:
        publish("orchestrator_reviewing", {"agent": agent_name, "attempt": attempt, "note": "auto-accepting after max retries"})
        return {"decision": "ACCEPT", "score": 7, "feedback": "Auto-accepted after max retries.", "issues": []}

    sample = [s for s in sequences[:3] if "parse_error" not in s]
    if not sample:
        return {"decision": "REJECT", "score": 0, "feedback": "All sampled sequences have parse errors.", "issues": ["JSON parse failure"]}

    client = _anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    prompt = f"""You are a quality reviewer for a B2B sales outreach platform.

Review the output from the {agent_name.replace("_", " ").title()} below.

TASK: Generate personalised outreach sequences for {leads_count} B2B leads.
SAMPLE OUTPUT (reviewing {len(sample)} of {len(sequences)} sequences, attempt {attempt}):
{json.dumps(sample, indent=2)}

Score this output on a scale of 1-10 based on:
1. Personalisation depth — does each message reference the lead's specific role, company, industry?
2. Format compliance — correct JSON, required fields present, no truncated content
3. Content quality — compelling, professional, human-sounding copy
4. Channel rules — SMS ≤ 160 chars, LinkedIn connection requests ≤ 300 chars

SCORING:
- 8-10: ACCEPT — high quality, minimal issues
- 7: ACCEPT — acceptable quality, minor issues noted
- 1-6: REJECT — significant issues, provide specific actionable feedback

Return JSON only, no other text:
{{"decision": "ACCEPT", "score": 8, "feedback": "...", "issues": []}}"""

    try:
        response = client.messages.create(
            model="claude-opus-4-8",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        clean = text.strip()
        if clean.startswith("```"):
            clean = re.sub(r"^```[a-z]*\n?", "", clean)
            clean = re.sub(r"\n?```$", "", clean.strip())
        result = json.loads(clean)
        publish("orchestrator_reviewing", {
            "agent": agent_name,
            "attempt": attempt,
            "decision": result.get("decision"),
            "score": result.get("score"),
        })
        return result
    except Exception as e:
        return {"decision": "ACCEPT", "score": 7, "feedback": f"Review error: {e} — auto-accepted.", "issues": []}


def merge_sequences(
    outreach_seqs: list[dict],
    email_seqs: list[dict],
    sms_seqs: list[dict],
    plan: list[dict],
) -> list[dict]:
    """
    Merge outputs from all specialist agents into one unified list per lead,
    tagged with which agents contributed.
    """
    merged: dict[str, dict] = {}

    def _key(name: str) -> str:
        return (name or "").strip().lower()

    for seq in outreach_seqs:
        k = _key(seq.get("lead_name", ""))
        merged[k] = {**seq, "_source_agents": ["outreach_agent"]}

    for seq in email_seqs:
        k = _key(seq.get("lead_name", ""))
        if k in merged:
            merged[k]["email_sequence"] = seq.get("sequence", [])
            merged[k]["personalisation_note"] = seq.get("personalisation_note", "")
            merged[k]["_source_agents"].append("email_agent")
        else:
            merged[k] = {**seq, "_source_agents": ["email_agent"]}

    for seq in sms_seqs:
        k = _key(seq.get("lead_name", ""))
        if k in merged:
            merged[k]["sms_sequence"] = seq.get("sequence", [])
            merged[k]["_source_agents"].append("sms_agent")
        else:
            merged[k] = {**seq, "_source_agents": ["sms_agent"]}

    plan_map = {_key(p.get("lead_name", "")): p for p in plan}
    for k, seq in merged.items():
        if k in plan_map:
            seq["_campaign_plan"] = plan_map[k]

    return list(merged.values())
