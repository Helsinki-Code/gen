"""
SMS Outreach Agent — 3-step SMS sequences (160-char enforced) for leads with phone numbers.
Reads config from agents/config.py (Settings → .env).
"""
from __future__ import annotations

import json
import re
from typing import Callable, Optional

import anthropic

from agents.config import ANTHROPIC_API_KEY, SMS_AGENT_ID, SMS_AGENT_VERSION, SMS_ENV_ID


def _filter_sms_leads(leads: list[dict]) -> list[dict]:
    sms_leads = []
    for lead in leads:
        phone = lead.get("Phone") or lead.get("Mobile") or lead.get("phone") or ""
        if phone and str(phone).strip().lower() not in ("", "n/a", "none", "-"):
            sms_leads.append(lead)
    return sms_leads


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


def _build_prompt(leads: list[dict], seller_context: str, batch: int, total: int) -> str:
    parts = []
    if seller_context:
        parts.append(f"SELLER CONTEXT:\n{seller_context[:2000]}")
    csv_text = _rows_to_csv(leads)
    parts.append(
        f"LEADS WITH PHONE NUMBERS (batch {batch}/{total}, {len(leads)} leads):\n"
        f"```csv\n{csv_text}\n```\n\n"
        f"Generate a 3-step SMS sequence for every lead. "
        f"CRITICAL: Every SMS must be 160 characters or fewer. "
        f"Return pure JSON array as per your instructions."
    )
    return "\n\n".join(parts)


def _run_session(
    client: anthropic.Anthropic,
    prompt: str,
    batch: int,
    total: int,
    progress_cb: Optional[Callable],
) -> str:
    agent_ref = {"type": "agent", "id": SMS_AGENT_ID, "version": SMS_AGENT_VERSION}
    session = client.beta.sessions.create(
        agent=agent_ref,
        environment_id=SMS_ENV_ID,
        extra_body={"title": f"SMS batch {batch}/{total}"},
    )

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
                        if progress_cb:
                            progress_cb("agent_text", {"text": block.text})
            elif event.type == "session.status_idle":
                stop = getattr(event, "stop_reason", None)
                if stop and getattr(stop, "type", None) == "requires_action":
                    continue
                break
            elif event.type == "session.status_terminated":
                break
    return full_text


def _parse(raw: str) -> list[dict]:
    clean = raw.strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```[a-z]*\n?", "", clean)
        clean = re.sub(r"\n?```$", "", clean.strip())
    try:
        result = json.loads(clean)
        return result if isinstance(result, list) else [result]
    except json.JSONDecodeError as e:
        return [{"raw": raw[:500], "parse_error": str(e)}]


def _validate_char_limits(sequences: list[dict]) -> list[dict]:
    for seq in sequences:
        if "parse_error" in seq:
            continue
        for step in seq.get("sequence", []):
            content = step.get("content", "")
            step["actual_char_count"] = len(content)
            step["within_limit"] = len(content) <= 160
    return sequences


def run(
    leads: list[dict],
    seller_context: str = "",
    batch_size: int = 5,
    progress_cb: Optional[Callable[[str, dict], None]] = None,
) -> dict:
    """
    Run the SMS Outreach Agent. Automatically skips leads without phone numbers.
    Returns {sequences: [...], agent: "sms_agent", skipped: N}.
    """
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    sms_leads = _filter_sms_leads(leads)
    skipped = len(leads) - len(sms_leads)

    def publish(t: str, d: dict = {}) -> None:
        if progress_cb:
            progress_cb(t, d)

    if not sms_leads:
        return {"sequences": [], "agent": "sms_agent", "skipped": skipped}

    batches = [sms_leads[i:i + batch_size] for i in range(0, len(sms_leads), batch_size)]
    all_sequences: list[dict] = []

    for i, batch in enumerate(batches, 1):
        publish("sms_batch_start", {"batch": i, "total": len(batches), "count": len(batch)})
        prompt = _build_prompt(batch, seller_context, i, len(batches))
        raw = _run_session(client, prompt, i, len(batches), progress_cb)
        seqs = _parse(raw)
        seqs = _validate_char_limits(seqs)
        all_sequences.extend(seqs)
        valid = sum(1 for s in seqs if "parse_error" not in s)
        publish("sms_batch_done", {"batch": i, "parsed": valid})

    publish("sms_sequences_ready", {"count": len(all_sequences)})
    return {"sequences": all_sequences, "agent": "sms_agent", "skipped": skipped}
