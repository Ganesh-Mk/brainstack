"""Metering every `/v1` call (PHASE_11 §4, step 7).

Middleware rather than a dependency, for one reason: a dependency cannot log
the calls that a *dependency* rejected. Invalid keys, missing scopes and rate
limits are exactly the rows you need when a credential leaks, so the recorder
has to sit outside the dependency chain.

Streaming responses are metered after the body iterator is exhausted, not when
the handler returns — otherwise every SSE ask would record a few milliseconds
and no trace id.

The write is best-effort and always in its own session. Metering must never
break the response — the same discipline query-trace writes have followed
since Phase 9.
"""

from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app import db as app_db
from app.models import ApiRequest

log = logging.getLogger("metering")

PREFIX = "/v1"


def _record(request: Request, response: Response | None, status_code: int, started: float) -> None:
    state = request.state
    try:
        session = app_db.SessionLocal()
        try:
            route = request.scope.get("route")
            session.add(
                ApiRequest(
                    tenant_id=getattr(state, "tenant_id", None),
                    api_key_id=getattr(state, "api_key_id", None),
                    request_id=getattr(state, "request_id", "") or str(uuid.uuid4()),
                    method=request.method[:8],
                    route=(getattr(route, "path", None) or request.url.path)[:80],
                    status_code=status_code,
                    latency_ms=round((time.perf_counter() - started) * 1000),
                    error_code=getattr(state, "error_code", None),
                    query_trace_id=getattr(state, "query_trace_id", None),
                    environment=getattr(state, "environment", "live"),
                    ip=(request.client.host if request.client else None),
                    user_agent=(request.headers.get("user-agent") or "")[:120] or None,
                )
            )
            session.commit()
        finally:
            session.close()
    except Exception:
        log.warning("api request metering failed", exc_info=True)


class MeteringMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith(PREFIX):
            return await call_next(request)

        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            _record(request, None, 500, started)
            raise

        response.headers["X-Request-Id"] = request_id

        body_iterator = getattr(response, "body_iterator", None)
        if body_iterator is None:
            _record(request, response, response.status_code, started)
            return response

        # Streamed: meter once the last byte is out, so latency and the trace
        # id the handler set mid-stream are both real.
        async def wrapped():
            try:
                async for chunk in body_iterator:
                    yield chunk
            finally:
                _record(request, response, response.status_code, started)

        response.body_iterator = wrapped()
        return response
