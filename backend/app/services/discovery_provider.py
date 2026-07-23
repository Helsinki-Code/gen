from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod

import anthropic

from app.config import get_settings


class SearchResearchProvider(ABC):
    @abstractmethod
    def research(self, *, criteria: dict, partition: dict, queries: list[dict]) -> dict:
        raise NotImplementedError


class AnthropicManagedSearchProvider(SearchResearchProvider):
    def __init__(self) -> None:
        self.settings = get_settings()

    def research(self, *, criteria: dict, partition: dict, queries: list[dict]) -> dict:
        if not self.settings.discovery_agent_id or not self.settings.discovery_env_id:
            raise RuntimeError("Account Discovery agent is not configured")
        client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)
        session = client.beta.sessions.create(
            agent={
                "type": "agent",
                "id": self.settings.discovery_agent_id,
                "version": self.settings.discovery_agent_version,
            },
            environment_id=self.settings.discovery_env_id,
            extra_body={
                "vault_ids": self.settings.vault_ids_list,
                "title": f"Account discovery shard: {partition.get('industry') or 'general'}",
            },
        )
        prompt = self._prompt(criteria, partition, queries)
        final_text = ""
        with client.beta.sessions.events.stream(session_id=session.id) as stream:
            client.beta.sessions.events.send(
                session_id=session.id,
                events=[{"type": "user.message", "content": [{"type": "text", "text": prompt}]}],
            )
            for event in stream:
                if event.type == "agent.message":
                    final_text = "".join(
                        block.text for block in event.content if getattr(block, "type", "") == "text"
                    )
                elif event.type == "session.status_idle":
                    break
                elif event.type in ("session.status_terminated", "session.error"):
                    break
        payload = self._parse(final_text)
        payload["session_id"] = session.id
        payload["raw_text"] = final_text
        return payload

    @staticmethod
    def _parse(text: str) -> dict:
        match = re.search(r"```json\s*([\s\S]*?)\s*```", text)
        if match:
            return json.loads(match.group(1))
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
        raise ValueError("Discovery agent did not return parseable JSON")

    @staticmethod
    def _prompt(criteria: dict, partition: dict, queries: list[dict]) -> str:
        return f"""Research public business information for the following account-discovery shard.

SELLER AND ICP:
{json.dumps(criteria, indent=2)}

SHARD:
{json.dumps(partition, indent=2)}

APPROVED QUERIES (execute only these queries):
{json.dumps(queries, indent=2)}

Return evidence-backed B2B company accounts only. Do not search for or return credentials,
secrets, personal email dumps, exposed systems, private documents, or personal information.
Search-result snippets are clues: open and verify source pages before making a claim.
Do not invent dates. Use null when the publication date is unavailable.

Return ONLY one JSON code block with this shape:
{{
  "queries": [{{"family": "hiring", "query": "..."}}],
  "accounts": [{{
    "name": "Company",
    "domain": "company.com",
    "website_url": "https://company.com",
    "industry": "Industry",
    "location": "Location",
    "employee_range": "51-200",
    "icp_fit_score": 0,
    "icp_rationale": "Evidence-based rationale",
    "evidence": [{{
      "signal_type": "hiring",
      "source_url": "https://...",
      "source_title": "Title",
      "source_type": "company",
      "publisher": "Publisher or null",
      "published_at": "YYYY-MM-DD or null",
      "summary": "Verified fact",
      "excerpt": "Short supporting excerpt, maximum 500 characters",
      "confidence": 0
    }}]
  }}]
}}
"""


def get_search_provider() -> SearchResearchProvider:
    return AnthropicManagedSearchProvider()
