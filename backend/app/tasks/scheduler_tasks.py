from __future__ import annotations

from datetime import datetime, timezone

from app.tasks.worker_app import worker_app


# ── Public task entrypoints (sync, as procrastinate requires) ─────────────────

@worker_app.periodic(cron="*/15 * * * *")
@worker_app.task(name="send_due_steps_task")
def send_due_steps_task(timestamp: int | None = None) -> dict:
    """Find all sequence steps due for sending and dispatch them."""
    import asyncio
    return asyncio.run(_send_due_steps_async())


@worker_app.task(name="send_day1_steps_task")
def send_day1_steps_task(campaign_id: str) -> dict:
    """Immediately send all day-1 steps for a just-launched campaign."""
    import asyncio
    return asyncio.run(_send_day1_steps_async(campaign_id))


@worker_app.periodic(cron="*/15 * * * *")
@worker_app.task(name="check_campaign_schedules_task")
def check_campaign_schedules_task(timestamp: int | None = None) -> dict:
    """Auto-trigger approved campaigns for users who have scheduling enabled."""
    import re
    from datetime import datetime, timezone
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import sessionmaker
    from app.config import get_settings
    from app.models.user import User
    from app.models.campaign import Campaign

    settings = get_settings()
    sync_url = settings.database_url.replace("+asyncpg", "").replace("?ssl=require", "?sslmode=require")
    engine = create_engine(sync_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False)
    db = SessionLocal()
    triggered = 0

    try:
        users = db.execute(
            select(User).where(User.schedule_config.isnot(None))
        ).scalars().all()

        now_utc = datetime.now(timezone.utc)

        for user in users:
            config = user.schedule_config
            if not config or not config.get("enabled"):
                continue

            mode = config.get("mode", "manual")
            if mode == "manual":
                continue

            send_time = config.get("send_time", "09:00")
            try:
                send_h, send_m = map(int, send_time.split(":"))
            except Exception:
                continue

            tz_name = config.get("timezone", "UTC")
            try:
                import zoneinfo
                tz = zoneinfo.ZoneInfo(tz_name)
                now_local = now_utc.astimezone(tz)
            except Exception:
                now_local = now_utc

            if now_local.hour != send_h:
                continue
            if not (0 <= now_local.minute - send_m < 15):
                continue

            if mode in ("weekly", "biweekly"):
                days = [d.lower() for d in config.get("days", [])]
                day_name = now_local.strftime("%A").lower()
                if day_name not in days:
                    continue

            campaigns = db.execute(
                select(Campaign).where(
                    Campaign.user_id == user.id,
                    Campaign.status == "approved",
                )
            ).scalars().all()

            for campaign in campaigns:
                campaign.status = "sending"
                db.commit()
                send_day1_steps_task.defer(campaign_id=str(campaign.id))
                triggered += 1
                print(f"[schedule] Auto-triggered campaign {campaign.id} for user {user.email}", flush=True)

        return {"triggered": triggered}
    finally:
        db.close()


# ── Internal async implementation ─────────────────────────────────────────────

def _make_async_engine():
    """Create a fresh async engine for use inside a single asyncio.run() call."""
    from sqlalchemy.ext.asyncio import create_async_engine
    from app.config import get_settings
    return create_async_engine(get_settings().database_url, pool_pre_ping=True)


def _normalize_e164(phone: str) -> str:
    import re
    digits = re.sub(r"[^\d+]", "", phone)
    return digits if digits.startswith("+") else "+" + digits


async def _send_due_steps_async() -> dict:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
    from app.models.sequence import SequenceStep

    now = datetime.now(timezone.utc)
    engine = _make_async_engine()
    AsyncDB = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    sent = 0
    failed = 0
    try:
        async with AsyncDB() as db:
            steps = (await db.execute(
                select(SequenceStep).where(
                    SequenceStep.status == "scheduled",
                    SequenceStep.scheduled_for <= now,
                    SequenceStep.channel.in_(["email", "sms"]),
                ).limit(50)
            )).scalars().all()

            for step in steps:
                try:
                    await _send_step_async(db, step, now)
                    sent += 1
                except Exception as exc:
                    await db.rollback()
                    step.status = "failed"
                    step.error_message = str(exc)[:500]
                    await db.commit()
                    failed += 1
    finally:
        await engine.dispose()

    return {"sent": sent, "failed": failed}


async def _send_day1_steps_async(campaign_id: str) -> dict:
    import uuid as _uuid
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
    from app.models.sequence import Sequence, SequenceStep

    engine = _make_async_engine()
    AsyncDB = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    now = datetime.now(timezone.utc)
    sent = 0
    failed = 0
    try:
        campaign_uuid = _uuid.UUID(campaign_id)
        async with AsyncDB() as db:
            seq_ids = (await db.execute(
                select(Sequence.id).where(Sequence.campaign_id == campaign_uuid)
            )).scalars().all()

            if not seq_ids:
                return {"sent": 0, "failed": 0}

            steps = (await db.execute(
                select(SequenceStep).where(
                    SequenceStep.sequence_id.in_(seq_ids),
                    SequenceStep.day == 1,
                    SequenceStep.status == "scheduled",
                    SequenceStep.channel.in_(["email", "sms"]),
                )
            )).scalars().all()

            for step in steps:
                try:
                    await _send_step_async(db, step, now)
                    sent += 1
                except Exception as exc:
                    await db.rollback()
                    step.status = "failed"
                    step.error_message = str(exc)[:500]
                    await db.commit()
                    failed += 1
    finally:
        await engine.dispose()

    return {"sent": sent, "failed": failed}


async def _send_step_async(db, step, now: datetime) -> None:
    from sqlalchemy import select
    from app.models.campaign import Campaign
    from app.models.lead import Lead
    from app.models.sequence import Sequence

    seq = (await db.execute(select(Sequence).where(Sequence.id == step.sequence_id))).scalar_one()
    lead = (await db.execute(select(Lead).where(Lead.id == step.lead_id))).scalar_one()
    campaign = (await db.execute(select(Campaign).where(Campaign.id == seq.campaign_id))).scalar_one()

    if step.channel == "email":
        if not lead.email:
            step.status = "skipped"
            await db.commit()
            return
        from app.services import resend_email, gmail
        resend_conn = await resend_email.get_connection(db, campaign.user_id)
        if resend_conn:
            await resend_email.send_email(
                db, campaign.user_id, lead.email,
                step.subject or "(no subject)", step.content,
            )
        else:
            await gmail.send_email(
                db=db, user_id=campaign.user_id, to=lead.email,
                subject=step.subject or "(no subject)", body=step.content,
            )

    elif step.channel == "sms":
        if not lead.phone:
            step.status = "skipped"
            step.error_message = "No phone number"
            await db.commit()
            return
        if lead.phone_type == "company_hq_line":
            step.status = "skipped"
            step.error_message = "Skipped: HQ landline cannot receive SMS"
            await db.commit()
            return
        normalized_phone = _normalize_e164(lead.phone)
        from app.services import twilio_sms
        twilio_conn = await twilio_sms.get_connection(db, campaign.user_id)
        if not twilio_conn:
            raise ValueError("Twilio not connected — connect it at Settings > Twilio SMS")
        await twilio_sms.send_sms(db, campaign.user_id, normalized_phone, step.content)

    step.status = "sent"
    step.sent_at = now
    await db.commit()
