"""
Email Outreach Agent — 5-step personalised email nurture sequences.
Reads config from agents/config.py (Settings → .env).
"""
from __future__ import annotations

import json
import re
from typing import Callable, Optional

import anthropic

from agents.config import ANTHROPIC_API_KEY, EMAIL_AGENT_ID, EMAIL_AGENT_VERSION, EMAIL_ENV_ID


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
        parts.append(f"SELLER CONTEXT:\n{seller_context[:3000]}")
    csv_text = _rows_to_csv(leads)
    parts.append(
        f"LEADS (batch {batch}/{total}, {len(leads)} leads):\n```csv\n{csv_text}\n```\n\n"
        f"Generate a 5-step email sequence for every lead. "
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
    agent_ref = {"type": "agent", "id": EMAIL_AGENT_ID, "version": EMAIL_AGENT_VERSION}
    session = client.beta.sessions.create(
        agent=agent_ref,
        environment_id=EMAIL_ENV_ID,
        extra_body={"title": f"Email batch {batch}/{total}"},
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


def run(
    leads: list[dict],
    seller_context: str = "",
    batch_size: int = 5,
    progress_cb: Optional[Callable[[str, dict], None]] = None,
) -> dict:
    """
    Run the Email Outreach Agent on batches of leads.
    Returns {sequences: [...], agent: "email_agent"}.
    """
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    batches = [leads[i:i + batch_size] for i in range(0, len(leads), batch_size)]
    all_sequences: list[dict] = []

    def publish(t: str, d: dict = {}) -> None:
        if progress_cb:
            progress_cb(t, d)

    for i, batch in enumerate(batches, 1):
        publish("email_batch_start", {"batch": i, "total": len(batches), "count": len(batch)})
        prompt = _build_prompt(batch, seller_context, i, len(batches))
        raw = _run_session(client, prompt, i, len(batches), progress_cb)
        seqs = _parse(raw)
        all_sequences.extend(seqs)
        valid = sum(1 for s in seqs if "parse_error" not in s)
        publish("email_batch_done", {"batch": i, "parsed": valid})

    publish("email_sequences_ready", {"count": len(all_sequences)})
    return {"sequences": all_sequences, "agent": "email_agent"}
