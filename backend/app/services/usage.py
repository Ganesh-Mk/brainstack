"""Per-key spend tracking and the monthly cost cap (PHASE_11 §4, step 5).

An LLM endpoint behind a long-lived credential without a spend ceiling is an
incident waiting for someone's for-loop. This is the guardrail that makes
handing out keys survivable.

Month-to-date spend is kept in Redis for speed and reconciled from
query_traces whenever the counter is missing (cold start, eviction, a new
month). Without Redis it falls back to querying query_traces directly — one
indexed aggregate per ask, which is acceptable, and means the cap still holds
where the rate limiter would have degraded to a no-op. A *spend* ceiling is
worth a query; a request counter is not.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import ratelimit
from app.models import QueryTrace

log = logging.getLogger("usage")

_MONTH_TTL = 40 * 24 * 3600  # comfortably longer than any month


def _month_key(api_key_id: uuid.UUID, now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    return f"cost:{api_key_id}:{now:%Y%m}"


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def month_start(now: datetime | None = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def spend_from_db(db: Session, api_key_id: uuid.UUID) -> float:
    """Sum this month's attributed cost for one key.

    The month filter runs in Python, matching stats._recent_traces: SQLite
    hands back naive datetimes and Postgres aware ones, so comparing in SQL
    would be portable only by accident. The row count is bounded by the key's
    own hourly limit, so this stays cheap.
    """
    rows = db.execute(
        select(QueryTrace.cost_usd, QueryTrace.created_at).where(
            QueryTrace.api_key_id == api_key_id
        )
    ).all()
    start = month_start()
    return float(
        sum(
            cost or 0.0
            for cost, created in rows
            if created and _aware(created) >= start
        )
    )


def month_to_date(db: Session, api_key_id: uuid.UUID) -> float:
    """Spend so far this calendar month, in USD."""
    client = ratelimit._redis()
    if client is None:
        return spend_from_db(db, api_key_id)
    key = _month_key(api_key_id)
    try:
        cached = client.get(key)
        if cached is not None:
            return float(cached)
        total = spend_from_db(db, api_key_id)
        client.set(key, total, ex=_MONTH_TTL)
        return total
    except Exception:
        log.warning("cost cache read failed — falling back to the table", exc_info=True)
        return spend_from_db(db, api_key_id)


def add_spend(api_key_id: uuid.UUID, cost_usd: float | None) -> None:
    """Bump the cached counter after an ask. Best effort: the table remains
    the source of truth, so a lost increment self-heals on the next miss."""
    if not cost_usd or api_key_id is None:
        return
    client = ratelimit._redis()
    if client is None:
        return
    try:
        key = _month_key(api_key_id)
        if client.exists(key):
            client.incrbyfloat(key, cost_usd)
            client.expire(key, _MONTH_TTL)
    except Exception:
        log.warning("cost cache increment failed", exc_info=True)


def over_cap(db: Session, api_key_id: uuid.UUID, cap: float | None) -> tuple[bool, float]:
    """(is_over, spent_so_far). No cap configured → never over."""
    if not cap:
        return False, 0.0
    spent = month_to_date(db, api_key_id)
    return spent >= cap, spent
