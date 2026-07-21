"""Celery worker (Phase 10) — the guide's 'migrate ingestion off
BackgroundTasks', done as a DECISION with the why written down:

  BackgroundTasks dies with the web process, has no retries, no queue you
  can inspect, and competes with request handling for the same CPU. Celery
  survives restarts, retries with backoff, scales to N workers, and `celery
  inspect active` shows you the queue.

Deployment reality: Render's free tier has no worker dynos, so the deployed
service keeps INGEST_MODE=inline (BackgroundTasks). `docker compose up`
runs the full production shape: this worker consuming from Redis.

Run: celery -A app.worker worker --loglevel=info --concurrency=2
"""

from __future__ import annotations

import logging

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

log = logging.getLogger("worker")

settings = get_settings()

celery_app = Celery(
    "brainstack",
    broker=settings.REDIS_URL or "redis://localhost:6379/0",
    backend=None,  # results aren't read — Document.status is the ledger
    broker_connection_retry_on_startup=True,
)
celery_app.conf.task_acks_late = True  # a killed worker's task is redelivered

# Housekeeping (Phase 11). api_requests is the fastest-growing table the
# platform has — one row per /v1 call — so it is pruned nightly to the
# configured retention window. 03:17 rather than 03:00: nothing else should
# ever line up on the same tick.
celery_app.conf.beat_schedule = {
    "prune-api-requests": {
        "task": "prune_api_requests",
        "schedule": crontab(hour=3, minute=17),
    },
}
celery_app.conf.timezone = "UTC"


@celery_app.task(
    name="ingest_document",
    autoretry_for=(Exception,),
    retry_backoff=10,
    retry_kwargs={"max_retries": 2},
)
def ingest_document(document_id: str) -> None:
    import uuid

    from app.services.ingestion import run_ingestion

    run_ingestion(uuid.UUID(document_id))


@celery_app.task(name="prune_api_requests")
def prune_api_requests() -> int:
    """Drop api_requests rows past API_REQUEST_RETENTION_DAYS.

    Deliberately NOT autoretrying: if a night's prune fails, the next one
    picks up everything it missed. Retrying a bulk DELETE against a busy
    table buys nothing and risks piling work onto whatever already broke.
    """
    from app.db import SessionLocal
    from app.services import apiusage

    session = SessionLocal()
    try:
        deleted = apiusage.prune(session, get_settings().API_REQUEST_RETENTION_DAYS)
        log.info("pruned %s api_requests rows", deleted)
        return deleted
    finally:
        session.close()
