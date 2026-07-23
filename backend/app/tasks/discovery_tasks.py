from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import procrastinate
from sqlalchemy import create_engine, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import sessionmaker

from app.tasks.worker_app import worker_app


def _db_session():
    from app.config import get_settings

    settings = get_settings()
    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    sync_url = sync_url.replace("?ssl=require", "?sslmode=require")
    kwargs = {"sslmode": "require"} if "sslmode=require" in sync_url else {}
    engine = create_engine(sync_url, pool_pre_ping=True, connect_args=kwargs)
    return sessionmaker(bind=engine)()


_pg_conns: dict[str, object] = {}


def _publish(run_id: str, event: dict) -> None:
    import psycopg2
    from app.config import get_settings

    db_url = get_settings().database_url
    channel = f"discovery:{run_id}:progress"
    payload = json.dumps(event, default=str)
    conn = _pg_conns.get(db_url)
    try:
        if conn is None or conn.closed:
            raise Exception("no conn")
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO campaign_events (channel, payload) VALUES (%s, %s::jsonb)",
                (channel, payload),
            )
        conn.commit()
    except Exception:
        try:
            if conn:
                conn.close()
        except Exception:
            pass
        sync_url = db_url.replace("postgresql+asyncpg://", "postgresql://").replace("?ssl=require", "?sslmode=require")
        conn = psycopg2.connect(sync_url)
        conn.autocommit = False
        _pg_conns[db_url] = conn
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO campaign_events (channel, payload) VALUES (%s, %s::jsonb)",
                (channel, payload),
            )
        conn.commit()


def _parse_date(value) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _finalize_if_ready(run_id: uuid.UUID) -> None:
    from app.models.discovery import DiscoveryRun, DiscoveryShard, ProspectAccount

    db = _db_session()
    try:
        run = db.execute(select(DiscoveryRun).where(DiscoveryRun.id == run_id).with_for_update()).scalar_one()
        if run.status == "cancelled":
            return
        counts = dict(db.execute(
            select(DiscoveryShard.status, func.count()).where(
                DiscoveryShard.discovery_run_id == run_id
            ).group_by(DiscoveryShard.status)
        ).all())
        finished = counts.get("completed", 0) + counts.get("failed", 0)
        run.completed_shards = finished
        if finished < run.total_shards:
            db.commit()
            return
        account_count = db.execute(
            select(func.count()).select_from(ProspectAccount).where(
                ProspectAccount.discovery_run_id == run_id
            )
        ).scalar_one()
        run.discovered_accounts = account_count
        run.completed_at = datetime.now(timezone.utc)
        if counts.get("completed", 0) == 0:
            run.status = "failed"
            run.completion_reason = "provider_exhausted"
            run.error_message = run.error_message or "All discovery shards failed"
            event = {"type": "run_failed", "status": "failed", "message": run.error_message}
        else:
            run.status = "review"
            run.completion_reason = "target_reached" if account_count >= run.requested_accounts else "provider_exhausted"
            event = {
                "type": "review_ready" if account_count >= run.requested_accounts else "run_partially_completed",
                "status": "review",
                "count": account_count,
                "completion_reason": run.completion_reason,
            }
        db.commit()
        _publish(str(run_id), event)
    finally:
        db.close()


@worker_app.task(retry=procrastinate.RetryStrategy(max_attempts=2, linear_wait=30), name="run_discovery_task")
def run_discovery_task(run_id: str) -> dict:
    from app.config import get_settings
    from app.models.discovery import DiscoveryQuery, DiscoveryRun, DiscoveryShard
    from app.services.discovery_planner import build_queries, plan_shards

    settings = get_settings()
    run_uuid = uuid.UUID(run_id)
    db = _db_session()
    try:
        run = db.execute(select(DiscoveryRun).where(DiscoveryRun.id == run_uuid).with_for_update()).scalar_one()
        if run.status == "cancelled":
            return {"status": "cancelled"}
        run.status = "planning"
        db.commit()
        _publish(run_id, {"type": "planning_started", "status": "planning"})

        partitions = plan_shards(run.criteria, run.requested_accounts, settings.discovery_shard_size)
        shard_ids: list[str] = []
        query_plan: list[dict] = []
        for index, partition in enumerate(partitions):
            shard = DiscoveryShard(
                discovery_run_id=run_uuid,
                batch_index=index,
                partition_criteria=partition,
                target_accounts=partition["target_accounts"],
            )
            db.add(shard)
            db.flush()
            queries = build_queries(run.criteria, partition, settings.discovery_queries_per_shard)
            for query in queries:
                db.add(DiscoveryQuery(
                    discovery_run_id=run_uuid,
                    discovery_shard_id=shard.id,
                    family=query["family"],
                    query_text=query["query"],
                    provider="anthropic",
                ))
            shard.query_count = len(queries)
            shard_ids.append(str(shard.id))
            query_plan.append({"shard": index, "partition": partition, "queries": queries})
        run.total_shards = len(shard_ids)
        run.status = "searching"
        db.commit()

        from app.services.storage import upload_text
        path = f"{run.user_id}/discoveries/{run_id}/query-plan.json"
        run.query_plan_path = asyncio.run(upload_text(json.dumps(query_plan, indent=2), path))
        db.commit()
        _publish(run_id, {"type": "shards_created", "status": "searching", "count": len(shard_ids)})

        for shard_id in shard_ids:
            research_discovery_shard.defer(shard_id=shard_id)
        run.celery_task_id = f"procrastinate:shards:{len(shard_ids)}"
        db.commit()
        return {"run_id": run_id, "shards": len(shard_ids)}
    except Exception as exc:
        db.rollback()
        db.execute(update(DiscoveryRun).where(DiscoveryRun.id == run_uuid).values(
            status="failed", error_message=str(exc), completed_at=datetime.now(timezone.utc)
        ))
        db.commit()
        _publish(run_id, {"type": "run_failed", "status": "failed", "message": str(exc)})
        raise
    finally:
        db.close()


@worker_app.task(retry=procrastinate.RetryStrategy(max_attempts=3, linear_wait=30), name="research_discovery_shard")
def research_discovery_shard(shard_id: str, *, job_context: procrastinate.JobContext = None) -> dict:
    from app.models.discovery import DiscoveryQuery, DiscoveryRun, DiscoveryShard, ProspectAccount, ResearchEvidence
    from app.services.discovery_provider import get_search_provider
    from app.services.discovery_safety import UnsafeDiscoveryInput, normalize_domain, validate_public_url, validate_query
    from app.services.discovery_scoring import (
        clamp_score,
        composite_score,
        recency_score,
        source_quality_score,
    )

    shard_uuid = uuid.UUID(shard_id)
    db = _db_session()
    run_id: uuid.UUID | None = None
    try:
        shard = db.execute(select(DiscoveryShard).where(DiscoveryShard.id == shard_uuid).with_for_update()).scalar_one()
        run = db.execute(select(DiscoveryRun).where(DiscoveryRun.id == shard.discovery_run_id)).scalar_one()
        run_id = run.id
        if run.status == "cancelled":
            shard.status = "cancelled"
            db.commit()
            return {"status": "cancelled"}
        shard.status = "running"
        shard.attempts += 1
        shard.started_at = datetime.now(timezone.utc)
        queries_db = db.execute(
            select(DiscoveryQuery).where(DiscoveryQuery.discovery_shard_id == shard_uuid)
        ).scalars().all()
        queries = [{"family": q.family, "query": validate_query(q.query_text)} for q in queries_db]
        db.commit()
        _publish(str(run_id), {"type": "shard_started", "shard": shard.batch_index})

        output = get_search_provider().research(
            criteria=run.criteria, partition=shard.partition_criteria, queries=queries
        )
        now = datetime.now(timezone.utc)
        raw_accounts = output.get("accounts") if isinstance(output.get("accounts"), list) else []
        shard.raw_candidate_count = len(raw_accounts)
        inserted = 0

        for query_row in queries_db:
            query_row.status = "completed"
            query_row.executed_at = now
            query_row.result_count = len(raw_accounts)
            _publish(str(run_id), {"type": "query_executed", "family": query_row.family})

        for raw in raw_accounts:
            if not isinstance(raw, dict):
                continue
            evidence_rows = raw.get("evidence") if isinstance(raw.get("evidence"), list) else []
            valid_evidence: list[dict] = []
            for evidence in evidence_rows:
                try:
                    source_url, source_domain = validate_public_url(str(evidence.get("source_url", "")))
                except UnsafeDiscoveryInput:
                    continue
                published = _parse_date(evidence.get("published_at"))
                source_type = str(evidence.get("source_type") or "aggregator").lower()
                quality = source_quality_score(source_type)
                if quality <= 0:
                    continue
                valid_evidence.append({
                    **evidence,
                    "source_url": source_url,
                    "source_domain": source_domain,
                    "published_at": published,
                    "source_type": source_type,
                    "quality": quality,
                })
            if not valid_evidence:
                continue
            domain = normalize_domain(str(raw.get("domain") or raw.get("website_url") or ""))
            if not domain or domain in {d.lower() for d in run.criteria.get("excluded_domains", [])}:
                continue
            website_url, _ = validate_public_url(str(raw.get("website_url") or f"https://{domain}"))
            icp = clamp_score(raw.get("icp_fit_score"))
            signal = max(clamp_score(e.get("confidence"), 50) for e in valid_evidence)
            recency = max(recency_score(e["published_at"], now) for e in valid_evidence)
            source_quality = max(e["quality"] for e in valid_evidence)
            composite = composite_score(icp, signal, recency, source_quality)
            account_id = uuid.uuid4()
            result = db.execute(
                pg_insert(ProspectAccount).values(
                    id=account_id,
                    discovery_run_id=run.id,
                    name=str(raw.get("name") or domain)[:255],
                    normalized_domain=domain,
                    website_url=website_url,
                    industry=(str(raw.get("industry"))[:255] if raw.get("industry") else None),
                    location=(str(raw.get("location"))[:255] if raw.get("location") else None),
                    employee_range=(str(raw.get("employee_range"))[:64] if raw.get("employee_range") else None),
                    icp_score=icp,
                    signal_score=signal,
                    recency_score=recency,
                    source_quality_score=source_quality,
                    composite_score=composite,
                    score_rationale=str(raw.get("icp_rationale") or "Evidence-backed ICP match"),
                    status="candidate",
                ).on_conflict_do_nothing(
                    index_elements=["discovery_run_id", "normalized_domain"]
                ).returning(ProspectAccount.id)
            ).scalar_one_or_none()
            if result:
                inserted += 1
            else:
                result = db.execute(select(ProspectAccount.id).where(
                    ProspectAccount.discovery_run_id == run.id,
                    ProspectAccount.normalized_domain == domain,
                )).scalar_one()
            for evidence in valid_evidence:
                summary = str(evidence.get("summary") or "").strip()
                digest = hashlib.sha256(
                    f"{evidence['source_url']}|{evidence.get('signal_type')}|{summary}".encode()
                ).hexdigest()
                db.execute(pg_insert(ResearchEvidence).values(
                    id=uuid.uuid4(),
                    user_id=run.user_id,
                    discovery_run_id=run.id,
                    prospect_account_id=result,
                    evidence_kind="account_signal",
                    signal_type=str(evidence.get("signal_type") or "public_report")[:64],
                    source_url=evidence["source_url"],
                    source_domain=evidence["source_domain"],
                    source_title=(str(evidence.get("source_title")) if evidence.get("source_title") else None),
                    publisher=(str(evidence.get("publisher"))[:255] if evidence.get("publisher") else None),
                    source_type=evidence["source_type"],
                    summary=summary or "Public business signal",
                    excerpt=(str(evidence.get("excerpt"))[:500] if evidence.get("excerpt") else None),
                    published_at=evidence["published_at"],
                    observed_at=now,
                    source_quality_score=evidence["quality"],
                    confidence_score=clamp_score(evidence.get("confidence"), 50),
                    content_hash=digest,
                    evidence_metadata={"shard_id": shard_id},
                ).on_conflict_do_nothing(
                    index_elements=["prospect_account_id", "content_hash"]
                ))

        shard.unique_candidate_count = inserted
        shard.status = "completed"
        shard.completed_at = now
        run.agent_session_ids = list({*(run.agent_session_ids or []), output.get("session_id")})
        account_count = db.execute(select(func.count()).select_from(ProspectAccount).where(
            ProspectAccount.discovery_run_id == run.id
        )).scalar_one()
        run.discovered_accounts = account_count
        db.commit()

        raw_path = f"{run.user_id}/discoveries/{run.id}/shard-{shard.batch_index}-output.json"
        from app.services.storage import upload_text
        asyncio.run(upload_text(json.dumps(output, default=str), raw_path))
        _publish(str(run.id), {
            "type": "shard_completed",
            "shard": shard.batch_index,
            "found": inserted,
            "total": account_count,
        })
        _finalize_if_ready(run.id)
        return {"status": "completed", "inserted": inserted}
    except Exception as exc:
        db.rollback()
        shard = db.execute(select(DiscoveryShard).where(DiscoveryShard.id == shard_uuid)).scalar_one_or_none()
        attempts = job_context.job.attempts if job_context and job_context.job else 0
        max_attempts = 3
        if shard:
            shard.error_message = str(exc)
            if attempts >= max_attempts - 1:
                shard.status = "failed"
                shard.completed_at = datetime.now(timezone.utc)
            else:
                shard.status = "pending"
            db.commit()
        if run_id and attempts >= max_attempts - 1:
            _publish(str(run_id), {"type": "shard_failed", "shard_id": shard_id, "message": str(exc)})
            _finalize_if_ready(run_id)
            return {"status": "failed", "error": str(exc)}
        raise exc
    finally:
        db.close()


@worker_app.task(name="dispatch_bulk_launch")
def dispatch_bulk_launch(job_id: str) -> dict:
    from app.models.campaign import Campaign
    from app.models.credit_transaction import CreditTransaction
    from app.models.discovery import BulkLaunchItem, BulkLaunchJob
    from app.models.user import User
    from app.tasks.pipeline_tasks import run_pipeline_task

    db = _db_session()
    completed = 0
    try:
        job = db.execute(select(BulkLaunchJob).where(BulkLaunchJob.id == uuid.UUID(job_id))).scalar_one()
        job.status = "running"
        db.commit()
        items = db.execute(select(BulkLaunchItem).where(
            BulkLaunchItem.bulk_launch_job_id == job.id,
            BulkLaunchItem.status == "pending",
        ).order_by(BulkLaunchItem.created_at)).scalars().all()
        for offset in range(0, len(items), 20):
            for item in items[offset:offset + 20]:
                try:
                    job_id_int = run_pipeline_task.defer(campaign_id=str(item.campaign_id))
                    campaign = db.execute(select(Campaign).where(Campaign.id == item.campaign_id)).scalar_one()
                    campaign.celery_task_id = str(job_id_int)
                    item.status = "dispatched"
                    completed += 1
                except Exception as exc:
                    item.status = "failed"
                    item.error_message = str(exc)
                    user = db.execute(select(User).where(User.id == job.user_id).with_for_update()).scalar_one()
                    user.credit_balance += item.credits_charged
                    db.add(CreditTransaction(
                        user_id=job.user_id,
                        campaign_id=item.campaign_id,
                        amount=item.credits_charged,
                        type="pipeline_refund",
                        description="Refund: campaign dispatch failed",
                    ))
            job.completed_accounts = completed
            db.commit()
        job.status = "complete"
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        return {"job_id": job_id, "dispatched": completed}
    finally:
        db.close()
