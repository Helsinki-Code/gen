"""
Ported from claude-sales-agents/lead_generator.py.
Adapted for: async-compatible sync interface, GCS output, progress callbacks.
"""
from __future__ import annotations

import csv
import io
import re
from typing import Callable

import anthropic

from agents.config import (
    ANTHROPIC_API_KEY,
    LEAD_AGENT_ID,
    LEAD_AGENT_VERSION,
    LEAD_ENV_ID,
    VAULT_IDS,
)


def run(
    url: str,
    num_leads: int,
    campaign_id: str,
    progress_cb: Callable[[str, dict], None] | None = None,
) -> dict:
    """
    Run the URL-to-Leads Managed Agent session.
    Returns {leads: [...dicts], leads_csv_text: str, report_text: str}.
    """

    def publish(event_type: str, data: dict = {}) -> None:
        if progress_cb:
            progress_cb(event_type, data)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    agent_ref = {"type": "agent", "id": LEAD_AGENT_ID, "version": LEAD_AGENT_VERSION}
    prompt = (
        f"Analyse {url} and generate a leads report with exactly {num_leads} verified leads.\n\n"
        f"IMPORTANT: At the very end of your response you MUST output all leads as a fenced CSV "
        f"code block using triple backticks with the 'csv' language tag, like this:\n\n"
        f"```csv\n"
        f"Name,Title,Company,Email,Phone,LinkedIn,Location,ICP_Fit_Score\n"
        f"Jane Smith,Head of Content,Acme Ltd,jane@acme.com,+44 20 7946 0000,"
        f"https://linkedin.com/in/janesmith,London UK,High\n"
        f"```\n\n"
        f"Use exactly these column names: Name, Title, Company, Email, Phone, LinkedIn, "
        f"Location, ICP_Fit_Score. The fenced CSV block is REQUIRED for the platform to "
        f"save the leads."
    )

    session = client.beta.sessions.create(
        agent=agent_ref,
        environment_id=LEAD_ENV_ID,
        extra_body={"vault_ids": VAULT_IDS, "title": f"Leads: {url}"},
    )
    publish("session_created", {"session_id": session.id})

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

    leads, csv_text = _extract_leads(full_text)
    publish("leads_extracted", {"count": len(leads)})

    return {
        "leads": leads,
        "leads_csv_text": csv_text,
        "report_text": full_text,
    }


def _extract_leads(text: str) -> tuple[list[dict], str]:
    """
    Extract leads CSV from agent response.
    Handles: fenced ```csv blocks, plain ``` blocks, unfenced "CSV Output" sections,
    and raw CSV lines that start with known header columns.
    """

    def _parse_csv(csv_text: str) -> list[dict]:
        try:
            reader = csv.DictReader(io.StringIO(csv_text.strip()))
            rows = [r for r in reader if any(str(v).strip() for v in r.values())]
            return rows
        except Exception:
            return []

    # 1. Fenced ```csv block
    match = re.search(r"```csv\n(.*?)```", text, re.DOTALL)
    if match:
        rows = _parse_csv(match.group(1))
        if rows:
            return rows, match.group(1).strip()

    # 2. Any fenced block whose first line looks like CSV headers
    for m in re.finditer(r"```[a-z]*\n(.*?)```", text, re.DOTALL):
        content = m.group(1).strip()
        first_line = content.split("\n")[0]
        if "," in first_line and len(first_line.split(",")) >= 3:
            rows = _parse_csv(content)
            if rows:
                return rows, content

    # 3. Unfenced "📊 Final CSV Output" / "CSV Output" / "CSV Data" section
    section = re.search(
        r"(?:📊\s*)?(?:Final\s+)?CSV\s+(?:Output|Data|Results?|Export)\s*[:\n]((?:.+\n?)+)",
        text,
        re.IGNORECASE,
    )
    if section:
        csv_text = re.split(r"\n\s*\n", section.group(1).strip())[0]
        rows = _parse_csv(csv_text)
        if rows:
            return rows, csv_text

    # 4. Last resort: find a header line with known CSV column patterns
    for pattern in [
        r"(?m)^((?:full_name|name),(?:linkedin_url|linkedin|title)[^\n]*\n(?:.+\n?)+)",
        r"(?m)^(Name,(?:Title|Role)[^\n]*\n(?:.+\n?)+)",
    ]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            csv_text = re.split(r"\n\s*\n", m.group(1).strip())[0]
            rows = _parse_csv(csv_text)
            if rows:
                return _normalize_csv_headers(rows), csv_text

    return [], ""


_FIELD_MAP = {
    "full_name": "Name",
    "current_title": "Title",
    "current_company": "Company",
    "linkedin_url": "LinkedIn",
    "confidence_score": "ICP_Fit_Score",
    "icp_fit_score": "ICP_Fit_Score",
    "fit_score": "ICP_Fit_Score",
    "mobile": "Phone",
}


def _normalize_csv_headers(rows: list[dict]) -> list[dict]:
    """Rename agent-style field names to canonical DB field names."""
    normalized = []
    for row in rows:
        new_row = {}
        for k, v in row.items():
            canonical = _FIELD_MAP.get(k.strip().lower(), k.strip())
            new_row[canonical] = v
        normalized.append(new_row)
    return normalized
