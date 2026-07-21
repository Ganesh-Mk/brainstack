"""Writing query_traces rows (PROJECT_GUIDE §2.16).

Shared by the app's ask stream and /v1/ask, because Phase 11 attributes both
channels to the same table — cost is authored exactly once, so API spend is a
join and never a second sum (PHASE_11 §1.6).

Always its own session: the error path runs after a rollback, and
observability must never break answering.
"""

from __future__ import annotations

import logging

from app import db as app_db
from app.models import QueryTrace

log = logging.getLogger("traces")


def write(**fields) -> None:
    try:
        session = app_db.SessionLocal()
        try:
            session.add(QueryTrace(**fields))
            session.commit()
        finally:
            session.close()
    except Exception:
        log.warning("query trace write failed", exc_info=True)
