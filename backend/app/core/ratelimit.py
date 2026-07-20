"""Per-tenant rate limiting (Phase 10) — fixed one-hour window in Redis.

Counts answered questions per tenant per hour: INCR + EXPIRE on first hit.
Ask endpoints call check() BEFORE starting a stream; a 429 carries a
friendly message with the reset time.

Graceful without Redis (unset REDIS_URL, or Redis down): the limiter is a
no-op — protection is an upgrade, never an outage. RATE_LIMIT_ASKS_PER_HOUR=0
disables it explicitly.
"""

from __future__ import annotations

import logging
import time

from fastapi import HTTPException

from app.config import get_settings

log = logging.getLogger("ratelimit")

_client = None
_failed = False


def _redis():
    global _client, _failed
    if _client is None and not _failed:
        settings = get_settings()
        if not settings.REDIS_URL:
            _failed = True
            return None
        try:
            import redis

            _client = redis.from_url(
                settings.REDIS_URL, socket_timeout=2, socket_connect_timeout=2
            )
        except Exception:
            log.warning("redis unavailable — rate limiting disabled", exc_info=True)
            _failed = True
    return _client


def check(tenant_id) -> None:
    """Raises 429 when the tenant is over this hour's ask budget."""
    settings = get_settings()
    limit = settings.RATE_LIMIT_ASKS_PER_HOUR
    if limit <= 0:
        return
    client = _redis()
    if client is None:
        return
    window = int(time.time() // 3600)
    key = f"rl:ask:{tenant_id}:{window}"
    try:
        count = client.incr(key)
        if count == 1:
            client.expire(key, 3700)
    except Exception:
        log.warning("rate limit check failed — allowing request", exc_info=True)
        return
    if count > limit:
        minutes = 60 - int(time.time() % 3600) // 60
        raise HTTPException(
            status_code=429,
            detail=(
                f"This workspace has used its {limit} questions for the hour. "
                f"It resets in about {minutes} minutes."
            ),
        )


def reset_for_tests() -> None:
    global _client, _failed
    _client, _failed = None, False
