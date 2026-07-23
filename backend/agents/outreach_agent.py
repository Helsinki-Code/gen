"""
Ported from claude-sales-agents/outreach_agent.py.
Adapted for: in-memory lead dicts (no CSV file), GCS output, progress callbacks.
"""
from __future__ import annotations

import json
import re
from typing import Callable

import anthropic

from agents.config import (
    ANTHROPIC_API_KEY,
    OUTREACH_AGENT_ID,
    OUTREACH_AGENT_VERSION,
    OUTREACH_ENV_ID,
)

DEFAULT_BATCH_SIZE = 5


def run(
    leads: list[dict],
    seller_context: str = "",
    batch_size: int = DEFAULT_BATCH_SIZE,
    progress_cb: Callable[[str, dict], None] | None = None,
) -> dict:
    """
    Run the Outreach Sequence Managed Agent on batches of leads.
    Returns {sequences: [...], sequences_md: str}.
    """

    def publish(event_type: str, data: dict = {}) -> None:
        if progress_cb:
            progress_cb(event_type, data)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    batches = [leads[i:i + batch_size] for i in range(0, len(leads), batch_size)]
    all_sequences: list[dict] = []

    for i, batch in enumerate(batches, 1):
        publish("batch_start", {"batch": i, "total": len(batches), "count": len(batch)})
        prompt = _build_prompt(batch, seller_context, i, len(batches))
        raw = _run_session(client, prompt, i, len(batches), progress_cb)
        seqs = _parse_sequences(raw)
        all_sequences.extend(seqs)
        valid = sum(1 for s in seqs if "parse_error" not in s)
        publish("batch_done", {"batch": i, "parsed": valid, "total": len(batch)})

    md_text = _build_md(all_sequences)
    return {"sequences": all_sequences, "sequences_md": md_text}


def _rows_to_csv_text(rows: list[dict]) -> str:
    if not rows:
        return ""
    headers = list(rows[0].keys())
    lines = [",".join(headers)]
    for row in rows:
        lines.append(",".join(f'"{(row.get(h) or "").replace(chr(34), chr(39))}"' for h in headers))
    return "\n".join(lines)


def _build_prompt(rows: list[dict], seller_context: str, batch_num: int, total_batches: int) -> str:
    parts: list[str] = []
    if seller_context:
        parts.append(f"SELLER CONTEXT (from research on the seller's website):\n{seller_context[:3000]}")
    csv_text = _rows_to_csv_text(rows)
    parts.append(
        f"LEADS DATA (batch {batch_num}/{total_batches}, {len(rows)} lead(s)):\n"
        f"```csv\n{csv_text}\n```\n\n"
        f"Analyse each lead, determine their available contact channels from the CSV data, "
        f"and generate a hyper-personalised outreach sequence for every lead. "
        f"Return a JSON array as per your instructions."
    )
    return "\n\n".join(parts)


def _run_session(
    client: anthropic.Anthropic,
    prompt: str,
    batch_num: int,
    total_batches: int,
    progress_cb: Callable | None,
) -> str:
    agent_ref = {"type": "agent", "id": OUTREACH_AGENT_ID, "version": OUTREACH_AGENT_VERSION}
    session = client.beta.sessions.create(
        agent=agent_ref,
        environment_id=OUTREACH_ENV_ID,
        extra_body={"title": f"Outreach batch {batch_num}/{total_batches}"},
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
                            progress_cb("sequence_text", {"text": block.text})
            elif event.type == "session.status_idle":
                stop = getattr(event, "stop_reason", None)
                if stop and getattr(stop, "type", None) == "requires_action":
                    continue
                break
            elif event.type == "session.status_terminated":
                break
    return full_text


def _parse_sequences(raw: str) -> list[dict]:
    clean = raw.strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```[a-z]*\n?", "", clean)
        clean = re.sub(r"\n?```$", "", clean.strip())
    try:
        result = json.loads(clean)
        return result if isinstance(result, list) else [result]
    except json.JSONDecodeError as e:
        return [{"raw": raw[:500], "parse_error": str(e)}]


def _build_md(sequences: list[dict]) -> str:
    lines: list[str] = ["# Outreach Sequences\n"]
    for seq in sequences:
        if "parse_error" in seq:
            lines.append(f"## [Parse Error]\n\n```\n{seq.get('raw', '')}\n```\n\n---\n")
            continue
        lines.append(
            f"## {seq.get('lead_name', 'Unknown')} — "
            f"{seq.get('title', '')} @ {seq.get('company', '')}"
        )
        lines.append(f"**Channels:** {', '.join(seq.get('channels', []))}\n")
        for step in seq.get("sequence", []):
            ch = (step.get("channel") or "").upper()
            tp = step.get("type") or ""
            day = step.get("day", "?")
            lines.append(f"### Step {step.get('step')} · Day {day} · {ch} — {tp}")
            if step.get("subject"):
                lines.append(f"**Subject:** {step['subject']}\n")
            lines.append(step.get("content", ""))
            lines.append("")
        lines.append("---\n")
    return "\n".join(lines)
