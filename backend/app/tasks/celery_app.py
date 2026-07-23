from __future__ import annotations

import os
import sys

from celery import Celery
from celery.schedules import crontab

# Add backend/ to sys.path immediately — this file is always the first thing
# Celery imports, so the agents package will be importable everywhere from here on.
_BACKEND_DIR = os.path.dirname(  # backend/
    os.path.dirname(             # backend/app/
        os.path.dirname(         # backend/app/tasks/
            os.path.abspath(__file__)
        )
    )
)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "amrogen",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.pipeline_tasks",
        "app.tasks.scheduler_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "send-due-steps": {
            "task": "app.tasks.scheduler_tasks.send_due_steps_task",
            "schedule": crontab(minute="*/15"),
        },
        "check-campaign-schedules": {
            "task": "app.tasks.scheduler_tasks.check_campaign_schedules_task",
            "schedule": crontab(minute="*/15"),
        },
    },
)
