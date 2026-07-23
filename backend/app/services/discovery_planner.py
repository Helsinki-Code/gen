from __future__ import annotations

import math

from app.services.discovery_safety import validate_query


SIGNAL_TERMS = {
    "hiring": '("hiring" OR "careers" OR "open positions")',
    "funding": '("raised" OR "funding round" OR "Series A" OR "Series B")',
    "expansion": '("expansion" OR "new office" OR "new market")',
    "leadership_change": '("appointed" OR "joins as" OR "new chief")',
    "product_launch": '("launched" OR "product launch" OR "announces")',
    "partnership": '("partnership" OR "strategic partner" OR "integration")',
    "competitor_usage": '("case study" OR "customer story" OR "implementation")',
    "public_report": '("annual report" OR "investor presentation" OR "strategy") filetype:pdf',
}


def plan_shards(criteria: dict, requested_accounts: int, shard_size: int) -> list[dict]:
    total = max(1, math.ceil(requested_accounts / shard_size))
    industries = criteria.get("industries") or [""]
    geographies = criteria.get("geographies") or [""]
    signals = criteria.get("signals") or ["hiring"]
    partitions: list[dict] = []
    for index in range(total):
        partitions.append({
            "industry": industries[index % len(industries)],
            "geography": geographies[(index // len(industries)) % len(geographies)],
            "primary_signal": signals[index % len(signals)],
            "employee_min": criteria.get("employee_min"),
            "employee_max": criteria.get("employee_max"),
            "target_accounts": min(shard_size, requested_accounts - index * shard_size),
        })
    return partitions


def build_queries(criteria: dict, partition: dict, max_queries: int) -> list[dict]:
    industry = partition.get("industry") or (criteria.get("industries") or [""])[0]
    geography = partition.get("geography") or (criteria.get("geographies") or [""])[0]
    base = " ".join(f'"{term}"' for term in (industry, geography) if term).strip()
    exclusions = " ".join(f'-"{term}"' for term in criteria.get("excluded_keywords", [])[:10])
    signals = criteria.get("signals") or ["hiring"]
    ordered = [partition.get("primary_signal")] + [s for s in signals if s != partition.get("primary_signal")]
    queries: list[dict] = []
    for signal in ordered:
        signal_terms = SIGNAL_TERMS.get(signal)
        if not signal_terms:
            continue
        if signal == "competitor_usage" and criteria.get("competitors"):
            for competitor in criteria["competitors"][:3]:
                query = f'"{competitor}" {signal_terms} {base} {exclusions}'
                queries.append({"family": signal, "query": validate_query(query)})
        else:
            query = f"{base} {signal_terms} {exclusions}"
            queries.append({"family": signal, "query": validate_query(query)})
        if len(queries) >= max_queries:
            break
    if len(queries) < max_queries:
        for family, suffix in (
            ("directory", '("member directory" OR "company directory")'),
            ("conference", '("sponsors" OR "exhibitors" OR "partners")'),
        ):
            queries.append({"family": family, "query": validate_query(f"{base} {suffix} {exclusions}")})
            if len(queries) >= max_queries:
                break
    return queries[:max_queries]
