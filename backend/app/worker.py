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

from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "brainstack",
    broker=settings.REDIS_URL or "redis://localhost:6379/0",
    backend=None,  # results aren't read — Document.status is the ledger
    broker_connection_retry_on_startup=True,
)
celery_app.conf.task_acks_late = True  # a killed worker's task is redelivered


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
