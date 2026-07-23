"""
Reply Monitor Agent — classifies incoming replies and recommends the next action.
Reads config from agents/config.py (Settings → .env).
"""
from __future__ import annotations

import json
import re
from typing import Callable, Optional

import anthropic

from agents.config import ANTHROPIC_API_KEY, REPLY_MONITOR_AGENT_ID, REPLY_MONITOR_AGENT_VERSION, REPLY_MONITOR_ENV_ID


def _build_prompt(
    lead_name: str,
    company: str,
    reply_channel: str,
    reply_text: str,
    original_outreach: str,
    seller_context: str,
) -> str:
    parts = []
    if seller_context:
        parts.append(f"SELLER CONTEXT:\n{seller_context[:1500]}")
    if original_outreach:
        parts.append(f"ORIGINAL OUTREACH SENT:\n{original_outreach[:1000]}")
    parts.append(
        f"INCOMING REPLY:\n"
        f"Lead: {lead_name} at {company}\n"
        f"Channel: {reply_channel}\n"
        f"Reply:\n{reply_text}\n\n"
        f"Analyse this reply and return your JSON assessment as per your instructions."
    )
    return "\n\n".join(parts)


def _parse(raw: str) -> dict:
    clean = raw.strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```[a-z]*\n?", "", clean)
        clean = re.sub(r"\n?```$", "", clean.strip())
    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        return {"raw": raw[:500], "parse_error": str(e)}


def analyse(
    lead_name: str,
    company: str,
    reply_channel: str,
    reply_text: str,
    original_outreach: str = "",
    seller_context: str = "",
    progress_cb: Optional[Callable[[str, dict], None]] = None,
) -> dict:
    """
    Analyse a single incoming reply.
    Returns dict with: intent, sentiment_score, next_action, suggested_response, etc.
    """
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def publish(t: str, d: dict = {}) -> None:
        if progress_cb:
            progress_cb(t, d)

    agent_ref = {
        "type": "agent",
        "id": REPLY_MONITOR_AGENT_ID,
        "version": REPLY_MONITOR_AGENT_VERSION,
    }
    prompt = _build_prompt(lead_name, company, reply_channel, reply_text, original_outreach, seller_context)

    session = client.beta.sessions.create(
        agent=agent_ref,
        environment_id=REPLY_MONITOR_ENV_ID,
        extra_body={"title": f"Reply: {lead_name} @ {company}"},
    )
    publish("reply_monitor_start", {"lead": lead_name, "company": company})

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
                        publish("agent_text", {"text": block.text})
            elif event.type == "session.status_idle":
                stop = getattr(event, "stop_reason", None)
                if stop and getattr(stop, "type", None) == "requires_action":
                    continue
                break
            elif event.type == "session.status_terminated":
                break

    result = _parse(full_text)
    publish("reply_monitor_done", {
        "lead": lead_name,
        "intent": result.get("intent", "unknown"),
        "action": result.get("next_action", "unknown"),
    })
    return result
