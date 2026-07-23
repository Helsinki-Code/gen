from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone

import procrastinate

from sqlalchemy import select, update

from app.tasks.worker_app import worker_app

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)


def _get_db_session():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.config import get_settings

    settings = get_settings()
    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    sync_url = sync_url.replace("?ssl=require", "?sslmode=require")
    engine = create_engine(sync_url, pool_pre_ping=True, connect_args={"sslmode": "require"})
    return sessionmaker(bind=engine)()


_pg_conns: dict[str, object] = {}


def _publish_progress(db_url: str, campaign_id: str, event: dict) -> None:
    import psycopg2
    channel = f"campaign:{campaign_id}:progress"
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


def _save_sequences_to_db(db, campaign, sequences_data: list[dict], db_leads) -> None:
    from app.models.sequence import Sequence, SequenceStep

    lead_map = {l.name: l for l in db_leads}

    for i, seq_data in enumerate(sequences_data):
        if "parse_error" in seq_data:
            continue

        lead_name = seq_data.get("lead_name", "")
        lead = lead_map.get(lead_name) or (db_leads[i] if i < len(db_leads) else None)
        if not lead:
            continue

        channels = seq_data.get("channels", [])
        if not channels:
            channels = list({
                step.get("channel", "")
                for step in (
                    seq_data.get("sequence", [])
                    + seq_data.get("email_sequence", [])
                    + seq_data.get("sms_sequence", [])
                )
                if step.get("channel")
            })

        sequence = Sequence(
            campaign_id=campaign.id,
            lead_id=lead.id,
            channels=channels,
            status="pending",
        )
        db.add(sequence)
        db.flush()

        all_steps = (
            seq_data.get("sequence", [])
            + seq_data.get("email_sequence", [])
            + seq_data.get("sms_sequence", [])
        )
        for step in all_steps:
            db.add(SequenceStep(
                sequence_id=sequence.id,
                lead_id=lead.id,
                step_number=step.get("step", 0),
                day=step.get("day", 1),
                channel=step.get("channel", ""),
                type=step.get("type", ""),
                subject=step.get("subject"),
                content=step.get("content", ""),
                status="pending",
            ))


def _parse_lead_field(row: dict, *keys: str) -> str | None:
    for k in keys:
        v = row.get(k) or row.get(k.lower()) or row.get(k.upper())
        if v:
            return str(v).strip()
    return None


@worker_app.task(retry=procrastinate.RetryStrategy(max_attempts=3, linear_wait=30), name="run_pipeline_task")
def run_pipeline_task(campaign_id: str) -> dict:
    import anthropic
    from app.config import get_settings
    from app.models.campaign import Campaign
    from app.models.lead import Lead

    settings = get_settings()

    def publish(event_type: str, data: dict = {}) -> None:
        _publish_progress(settings.database_url, campaign_id, {"type": event_type, **data})

    def fresh_db():
        return _get_db_session()

    try:
        # ── Read campaign ─────────────────────────────────────────────────────
        db = fresh_db()
        try:
            row = db.execute(
                select(Campaign).where(Campaign.id == uuid.UUID(campaign_id))
            ).scalar_one()
            target_url = row.target_url
            leads_requested = row.leads_requested
            user_id = str(row.user_id)
            row.status = "generating_leads"
            db.commit()
        finally:
            db.close()

        publish("status_change", {"status": "generating_leads"})

        # ── Create native multi-agent coordinator session ──────────────────────
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        session = client.beta.sessions.create(
            agent=settings.coordinator_agent_id,
            environment_id=settings.coordinator_env_id,
            vault_ids=settings.vault_ids_list,
            title=f"Campaign: {target_url}",
        )

        publish("session_created", {"session_id": session.id})

        kick_off = (
            f"Run the full outreach pipeline for: {target_url}. "
            f"Find {leads_requested} leads.\n\n"
            "When the pipeline is complete, output ONLY a JSON code block in this exact format:\n"
            "```json\n"
            "{\"meta\": {\"enrichment_stats\": {\"total_leads_discovered\": 0, \"leads_enriched\": 0, \"leads_confirmed\": 0}, "
            "\"icp_profiles\": [{\"icp_id\": \"ICP1\", \"profile_name\": \"\", \"industries\": [], \"pain_points\": []}]}, "
            "\"leads\": [...], \"sequences\": [...]}\n"
            "```\n"
            "Each lead object MUST include ALL of these fields:\n"
            "  Name, Title, Company, Email, email_type (direct_personal|company_generic|pattern_derived), "
            "email_confidence (High|Medium|Low), LinkedIn, Phone, "
            "phone_type (direct_mobile|company_hq_line|company_direct_line), "
            "phone_confidence (High|Medium|Low), Location, ICP_Fit_Score (integer 0-100), "
            "icp_fit (ICP1|ICP2|ICP3), icp_fit_justification, company_website, company_size, "
            "company_industry, company_funding_stage, best_outreach_angle, "
            "key_responsibilities, recent_activity, data_sources (array of strings)\n"
            "Each sequence: {\"lead_name\", \"channels\": [...], and one of: "
            "\"email_sequence\", \"sms_sequence\", or \"sequence\" — each a list of steps with "
            "{\"step\", \"day\", \"channel\", \"type\", \"subject\" (optional for SMS), \"content\"}}"
        )

        client.beta.sessions.events.send(
            session.id,
            events=[{
                "type": "user.message",
                "content": [{"type": "text", "text": kick_off}],
            }],
        )

        # ── Stream native multi-agent events, forwarding each to Redis ────────
        final_text = ""
        url_to_leads_done = False
        _thinking_count: dict[str, int] = {}   # throttle thinking events per agent

        for event in client.beta.sessions.events.stream(session_id=session.id):
            t = event.type

            if t == "agent.message":
                text = event.content[0].text if event.content else ""
                final_text = text
                publish("orchestrator_message", {"text": text[:800]})

            elif t == "agent.thinking":
                agent_name = getattr(event, "agent_name", "Multi-Agent Orchestrator")
                thinking = getattr(event, "thinking", "") or ""
                # Publish at most every 3rd thinking event per agent to reduce noise
                n = _thinking_count.get(agent_name, 0) + 1
                _thinking_count[agent_name] = n
                if n % 3 == 1:
                    publish("agent_thinking", {"agent_name": agent_name, "text": str(thinking)[:200]})

            elif t == "agent.tool_use":
                agent_name = getattr(event, "agent_name", "")
                tool_name = getattr(event, "name", "") or getattr(event, "tool_name", "") or "tool"
                tool_input = getattr(event, "input", {}) or {}
                # Extract meaningful preview from tool input
                preview = ""
                if isinstance(tool_input, dict):
                    for k in ("url", "query", "search_query", "phone_number", "email", "company"):
                        if k in tool_input:
                            preview = str(tool_input[k])[:80]
                            break
                publish("agent_tool_use", {"agent_name": agent_name, "tool": tool_name, "preview": preview})

            elif t == "agent.tool_result":
                agent_name = getattr(event, "agent_name", "")
                # Just mark the tool completed
                publish("agent_tool_done", {"agent_name": agent_name})

            elif t == "session.thread_created":
                agent_name = getattr(event, "agent_name", "")
                publish("thread_created", {"agent_name": agent_name})

            elif t in ("session.thread_status_run_started", "session.thread_status_running"):
                agent_name = getattr(event, "agent_name", "")
                publish("thread_running", {"agent_name": agent_name})
                name_lower = agent_name.lower()
                if not url_to_leads_done and ("leads" in name_lower or "url" in name_lower):
                    pass  # lead gen phase, already announced
                elif not url_to_leads_done:
                    url_to_leads_done = True
                    publish("status_change", {"status": "generating_sequences"})

            elif t in ("session.thread_idled", "session.thread_terminated", "session.thread_status_idle"):
                agent_name = getattr(event, "agent_name", "")
                publish("thread_done", {"agent_name": agent_name})
                if "leads" in agent_name.lower() or "url" in agent_name.lower():
                    url_to_leads_done = True
                    publish("status_change", {"status": "generating_sequences"})

            elif t == "agent.thread_message_sent":
                to_name = getattr(event, "to_agent_name", "")
                content = getattr(event, "content", None)
                text = ""
                if content and isinstance(content, list):
                    for blk in content:
                        if isinstance(blk, dict) and blk.get("type") == "text":
                            text = blk.get("text", "")[:500]
                            break
                        elif hasattr(blk, "text"):
                            text = str(blk.text)[:500]
                            break
                publish("agent_msg_sent", {"agent_name": to_name, "text": text})

            elif t == "agent.thread_message_received":
                from_name = getattr(event, "from_agent_name", "")
                content = getattr(event, "content", None)
                text = ""
                if content and isinstance(content, list):
                    for blk in content:
                        if isinstance(blk, dict) and blk.get("type") == "text":
                            text = blk.get("text", "")[:500]
                            break
                        elif hasattr(blk, "text"):
                            text = str(blk.text)[:500]
                            break
                publish("agent_msg_received", {"agent_name": from_name, "text": text})

            elif t == "session.error":
                err_msg = str(event)
                publish("error", {"message": err_msg})
                raise Exception(f"Anthropic session error: {err_msg}")

            elif t == "session.status_idled":
                break

            else:
                print(f"[DEBUG] unhandled session event: {t}", flush=True)

        # Reconnect to same session if stream ended without final JSON (avoids spawning new session)
        if not re.search(r"```json\s*([\s\S]*?)\s*```", final_text):
            for _attempt in range(2):
                print(f"[WARN] Stream ended without JSON, reconnecting to {session.id} attempt {_attempt + 1}", flush=True)
                try:
                    for event in client.beta.sessions.events.stream(session_id=session.id):
                        t = event.type
                        if t == "agent.message":
                            text = event.content[0].text if event.content else ""
                            final_text = text
                            publish("orchestrator_message", {"text": text[:800]})
                        elif t == "session.status_idled":
                            break
                        elif t == "session.error":
                            break
                except Exception as _re:
                    print(f"[WARN] Reconnect attempt {_attempt + 1} failed: {_re}", flush=True)
                if re.search(r"```json\s*([\s\S]*?)\s*```", final_text):
                    break

        # ── Parse the coordinator's final JSON output ─────────────────────────
        json_match = re.search(r"```json\s*([\s\S]*?)\s*```", final_text)
        if json_match:
            pipeline_output = json.loads(json_match.group(1))
        else:
            brace_match = re.search(r'\{[\s\S]*?"leads"[\s\S]*?\}', final_text)
            if brace_match:
                pipeline_output = json.loads(brace_match.group(0))
            else:
                raise Exception(
                    "Coordinator did not return a parseable JSON block. "
                    f"Last message preview: {final_text[:300]}"
                )

        meta = pipeline_output.get("meta", {})
        leads_data = pipeline_output.get("leads", [])
        sequences_data = pipeline_output.get("sequences", [])

        publish("leads_found", {"count": len(leads_data)})

        # ── Persist leads and sequences to DB ─────────────────────────────────
        db = fresh_db()
        try:
            campaign = db.execute(
                select(Campaign).where(Campaign.id == uuid.UUID(campaign_id))
            ).scalar_one()

            # Store campaign-level intelligence
            if meta.get("enrichment_stats"):
                campaign.enrichment_stats = meta["enrichment_stats"]
            if meta.get("icp_profiles"):
                campaign.icp_profiles = meta["icp_profiles"]

            for i, lead_row in enumerate(leads_data):
                # ICP score can be int or str
                raw_score = lead_row.get("ICP_Fit_Score") or lead_row.get("icp_fit_score") or lead_row.get("fit_score")
                icp_score_str = str(int(raw_score)) if raw_score is not None else None

                raw_sources = lead_row.get("data_sources")
                data_sources = raw_sources if isinstance(raw_sources, list) else None

                db.add(Lead(
                    campaign_id=campaign.id,
                    row_index=i,
                    name=_parse_lead_field(lead_row, "Name", "full_name", "name"),
                    title=_parse_lead_field(lead_row, "Title", "current_title", "title", "role"),
                    company=_parse_lead_field(lead_row, "Company", "current_company", "company", "organization"),
                    email=_parse_lead_field(lead_row, "Email", "email"),
                    email_type=_parse_lead_field(lead_row, "email_type"),
                    email_confidence=_parse_lead_field(lead_row, "email_confidence"),
                    linkedin_url=_parse_lead_field(lead_row, "LinkedIn", "linkedin_url", "linkedin"),
                    phone=_parse_lead_field(lead_row, "Phone", "phone", "Mobile", "mobile"),
                    phone_type=_parse_lead_field(lead_row, "phone_type"),
                    phone_confidence=_parse_lead_field(lead_row, "phone_confidence"),
                    location=_parse_lead_field(lead_row, "Location", "location"),
                    icp_fit_score=icp_score_str,
                    icp_fit=_parse_lead_field(lead_row, "icp_fit"),
                    icp_fit_justification=_parse_lead_field(lead_row, "icp_fit_justification"),
                    company_website=_parse_lead_field(lead_row, "company_website"),
                    company_size=_parse_lead_field(lead_row, "company_size"),
                    company_industry=_parse_lead_field(lead_row, "company_industry"),
                    company_funding_stage=_parse_lead_field(lead_row, "company_funding_stage"),
                    best_outreach_angle=_parse_lead_field(lead_row, "best_outreach_angle"),
                    key_responsibilities=_parse_lead_field(lead_row, "key_responsibilities"),
                    recent_activity=_parse_lead_field(lead_row, "recent_activity"),
                    data_sources=data_sources,
                ))
            db.flush()

            db_leads = db.execute(
                select(Lead).where(Lead.campaign_id == campaign.id).order_by(Lead.row_index)
            ).scalars().all()

            # ── HITL gate 1: pause for lead review ────────────────────────────
            # If sequences were already included (single-shot pipeline), save them now.
            # If not (two-phase flow), set leads_review and wait for confirm-leads.
            if sequences_data:
                _save_sequences_to_db(db, campaign, sequences_data, list(db_leads))
                db.commit()
                total_seqs = len(sequences_data)
                publish("sequences_ready", {"count": total_seqs})
                campaign.status = "review"
                db.commit()
                publish("status_change", {"status": "review"})
                total_seqs_result = total_seqs
            else:
                db.commit()
                campaign.status = "leads_review"
                db.commit()
                publish("status_change", {"status": "leads_review"})
                total_seqs_result = 0
        finally:
            db.close()

        return {"campaign_id": campaign_id, "leads": len(leads_data), "sequences": total_seqs_result}

    except Exception as exc:
        db_err = fresh_db()
        try:
            from app.models.campaign import Campaign as _C
            db_err.execute(
                update(_C)
                .where(_C.id == uuid.UUID(campaign_id))
                .values(status="failed", error_message=str(exc))
            )
            db_err.commit()
        except Exception:
            pass
        finally:
            db_err.close()
        publish("error", {"message": str(exc)})
        raise exc


@worker_app.task(retry=procrastinate.RetryStrategy(max_attempts=3, linear_wait=30), name="generate_sequences_task")
def generate_sequences_task(campaign_id: str) -> dict:
    """HITL gate 1 continuation: generate sequences from confirmed lead list."""
    import anthropic
    from app.config import get_settings
    from app.models.campaign import Campaign
    from app.models.lead import Lead

    settings = get_settings()

    def publish(event_type: str, data: dict = {}) -> None:
        _publish_progress(settings.database_url, campaign_id, {"type": event_type, **data})

    def fresh_db():
        return _get_db_session()

    try:
        db = fresh_db()
        try:
            campaign = db.execute(
                select(Campaign).where(Campaign.id == uuid.UUID(campaign_id))
            ).scalar_one()
            target_url = campaign.target_url
            db_leads = db.execute(
                select(Lead).where(Lead.campaign_id == campaign.id).order_by(Lead.row_index)
            ).scalars().all()

            campaign.status = "generating_sequences"
            db.commit()
        finally:
            db.close()

        publish("status_change", {"status": "generating_sequences"})

        # Build lead list for the prompt
        leads_json = json.dumps([
            {
                "Name": l.name, "Title": l.title, "Company": l.company,
                "Email": l.email, "email_type": l.email_type, "email_confidence": l.email_confidence,
                "LinkedIn": l.linkedin_url, "Phone": l.phone, "Location": l.location,
                "icp_fit": l.icp_fit, "icp_fit_score": l.icp_fit_score,
                "best_outreach_angle": l.best_outreach_angle,
                "company_website": l.company_website, "company_size": l.company_size,
                "company_industry": l.company_industry,
            }
            for l in db_leads
        ], indent=2)

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        session = client.beta.sessions.create(
            agent=settings.coordinator_agent_id,
            environment_id=settings.coordinator_env_id,
            vault_ids=settings.vault_ids_list,
            title=f"Sequences: {target_url}",
        )
        publish("session_created", {"session_id": session.id})

        seq_prompt = (
            f"Generate personalized outreach sequences for {target_url}.\n\n"
            f"Leads (already confirmed by user):\n{leads_json}\n\n"
            "Output ONLY a JSON code block:\n"
            "```json\n{\"sequences\": [...]}\n```\n"
            "Each sequence: {\"lead_name\", \"channels\": [...], and one of: "
            "\"email_sequence\", \"sms_sequence\", or \"sequence\" — each step: "
            "{\"step\", \"day\", \"channel\", \"type\", \"subject\" (email only), \"content\"}}"
        )

        client.beta.sessions.events.send(
            session.id,
            events=[{"type": "user.message", "content": [{"type": "text", "text": seq_prompt}]}],
        )

        final_text = ""
        _thinking_count: dict[str, int] = {}
        for event in client.beta.sessions.events.stream(session_id=session.id):
            t = event.type
            if t == "agent.message":
                final_text = event.content[0].text if event.content else ""
                publish("orchestrator_message", {"text": final_text[:800]})
            elif t == "agent.thinking":
                agent_name = getattr(event, "agent_name", "")
                thinking = str(getattr(event, "thinking", "") or "")[:200]
                n = _thinking_count.get(agent_name, 0) + 1
                _thinking_count[agent_name] = n
                if n % 3 == 1:
                    publish("agent_thinking", {"agent_name": agent_name, "text": thinking})
            elif t == "agent.tool_use":
                agent_name = getattr(event, "agent_name", "")
                tool_name = getattr(event, "name", "") or "tool"
                publish("agent_tool_use", {"agent_name": agent_name, "tool": tool_name, "preview": ""})
            elif t in ("session.thread_created",
                       "session.thread_status_run_started", "session.thread_status_running",
                       "session.thread_idled", "session.thread_terminated", "session.thread_status_idle"):
                agent_name = getattr(event, "agent_name", "")
                etype = {
                    "session.thread_created": "thread_created",
                    "session.thread_status_run_started": "thread_running",
                    "session.thread_status_running": "thread_running",
                    "session.thread_idled": "thread_done",
                    "session.thread_terminated": "thread_done",
                    "session.thread_status_idle": "thread_done",
                }[t]
                publish(etype, {"agent_name": agent_name})
            elif t == "agent.thread_message_sent":
                to_name = getattr(event, "to_agent_name", "")
                content = getattr(event, "content", None)
                text = ""
                if content and isinstance(content, list):
                    blk = content[0]
                    text = (blk.get("text", "") if isinstance(blk, dict) else str(getattr(blk, "text", "")))[:500]
                publish("agent_msg_sent", {"agent_name": to_name, "text": text})
            elif t == "agent.thread_message_received":
                from_name = getattr(event, "from_agent_name", "")
                content = getattr(event, "content", None)
                text = ""
                if content and isinstance(content, list):
                    blk = content[0]
                    text = (blk.get("text", "") if isinstance(blk, dict) else str(getattr(blk, "text", "")))[:500]
                publish("agent_msg_received", {"agent_name": from_name, "text": text})
            elif t == "session.error":
                raise Exception(f"Session error: {event}")
            elif t == "session.status_idled":
                break
            else:
                print(f"[DEBUG] unhandled sequences event: {t}", flush=True)

        # Reconnect to same session if stream ended without JSON
        if not re.search(r"```json\s*([\s\S]*?)\s*```", final_text):
            for _attempt in range(2):
                print(f"[WARN] Sequences stream ended without JSON, reconnecting to {session.id} attempt {_attempt + 1}", flush=True)
                try:
                    for event in client.beta.sessions.events.stream(session_id=session.id):
                        t = event.type
                        if t == "agent.message":
                            final_text = event.content[0].text if event.content else ""
                            publish("orchestrator_message", {"text": final_text[:800]})
                        elif t == "session.status_idled":
                            break
                        elif t == "session.error":
                            break
                except Exception as _re:
                    print(f"[WARN] Reconnect attempt {_attempt + 1} failed: {_re}", flush=True)
                if re.search(r"```json\s*([\s\S]*?)\s*```", final_text):
                    break

        json_match = re.search(r"```json\s*([\s\S]*?)\s*```", final_text)
        if json_match:
            output = json.loads(json_match.group(1))
        else:
            raise Exception(f"No JSON in sequences response. Preview: {final_text[:300]}")

        sequences_data = output.get("sequences", [])

        db = fresh_db()
        try:
            campaign = db.execute(
                select(Campaign).where(Campaign.id == uuid.UUID(campaign_id))
            ).scalar_one()
            db_leads = db.execute(
                select(Lead).where(Lead.campaign_id == campaign.id).order_by(Lead.row_index)
            ).scalars().all()
            _save_sequences_to_db(db, campaign, sequences_data, list(db_leads))
            db.commit()
            campaign.status = "review"
            db.commit()
        finally:
            db.close()

        publish("sequences_ready", {"count": len(sequences_data)})
        publish("status_change", {"status": "review"})
        return {"campaign_id": campaign_id, "sequences": len(sequences_data)}

    except Exception as exc:
        db_err = fresh_db()
        try:
            from app.models.campaign import Campaign as _C
            db_err.execute(
                update(_C)
                .where(_C.id == uuid.UUID(campaign_id))
                .values(status="failed", error_message=str(exc))
            )
            db_err.commit()
        except Exception:
            pass
        finally:
            db_err.close()
        publish("error", {"message": str(exc)})
        raise exc


@worker_app.task(retry=procrastinate.RetryStrategy(max_attempts=2, linear_wait=10), name="analyse_reply_task")
def analyse_reply_task(
    lead_name: str,
    company: str,
    reply_channel: str,
    reply_text: str,
    original_outreach: str = "",
    seller_context: str = "",
    sequence_id: str = "",
) -> dict:
    from app.config import get_settings
    from agents.reply_monitor import analyse

    settings = get_settings()

    def publish(t: str, d: dict = {}) -> None:
        if sequence_id:
            _publish_progress(settings.database_url, sequence_id, {"type": t, **d})

    try:
        result = analyse(
            lead_name=lead_name,
            company=company,
            reply_channel=reply_channel,
            reply_text=reply_text,
            original_outreach=original_outreach,
            seller_context=seller_context,
            progress_cb=lambda t, d: publish(t, d),
        )

        if sequence_id and result.get("next_action") in (
            "pause_sequence", "stop_sequence", "pause_30_days"
        ):
            from app.models.sequence import Sequence
            db = _get_db_session()
            try:
                db.execute(
                    update(Sequence)
                    .where(Sequence.id == uuid.UUID(sequence_id))
                    .values(status="paused" if "pause" in result["next_action"] else "stopped")
                )
                db.commit()
            finally:
                db.close()

        return result
    except Exception as exc:
        raise self.retry(exc=exc, countdown=10)
