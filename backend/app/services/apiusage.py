"""Reading the two API ledgers back out (PHASE_11 §5).

The join rule of this phase, in code: request counts, error rates and endpoint
breakdowns come from `api_requests`; tokens and cost come from `query_traces`.
Nothing sums cost out of api_requests, because cost is not stored there.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import ApiKey, ApiRequest, QueryTrace


def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _traces_since(db: Session, tenant_id: uuid.UUID, since: datetime) -> list[QueryTrace]:
    """query_traces stamps created_at server-side, so SQLite returns naive
    values and Postgres aware ones — the window is applied in Python, the
    same way stats._recent_traces does it."""
    rows = db.scalars(
        select(QueryTrace).where(QueryTrace.tenant_id == tenant_id)
    ).all()
    return [r for r in rows if r.created_at and _aware(r.created_at) >= since]


def key_rollup(db: Session, tenant_id: uuid.UUID, days: int = 7) -> dict[uuid.UUID, dict]:
    """Per-key totals for the settings table. One query per ledger, not one
    per key — this renders next to every row."""
    since = _since(days)

    counts = db.execute(
        select(
            ApiRequest.api_key_id,
            func.count().label("requests"),
            func.sum(case((ApiRequest.status_code >= 400, 1), else_=0)).label(
                "errors"
            ),
        )
        .where(
            ApiRequest.tenant_id == tenant_id,
            ApiRequest.created_at >= since,
            ApiRequest.api_key_id.is_not(None),
        )
        .group_by(ApiRequest.api_key_id)
    ).all()

    out: dict[uuid.UUID, dict] = {}
    for key_id, requests, errors in counts:
        out[key_id] = {
            "requests": int(requests or 0),
            "errors": int(errors or 0),
            "cost_usd": 0.0,
        }
    for trace in _traces_since(db, tenant_id, since):
        if trace.api_key_id is None:
            continue
        row = out.setdefault(
            trace.api_key_id, {"requests": 0, "errors": 0, "cost_usd": 0.0}
        )
        row["cost_usd"] = round(row["cost_usd"] + (trace.cost_usd or 0.0), 6)
    return out


def key_detail(db: Session, key: ApiKey, days: int = 14) -> dict:
    """The per-key drill-down: daily series, endpoint breakdown, recent calls."""
    since = _since(days)

    rows = db.scalars(
        select(ApiRequest)
        .where(ApiRequest.api_key_id == key.id, ApiRequest.created_at >= since)
        .order_by(ApiRequest.created_at.desc())
    ).all()

    per_day: dict[str, dict] = {}
    per_route: dict[str, dict] = {}
    for r in rows:
        day = r.created_at.date().isoformat() if r.created_at else "unknown"
        d = per_day.setdefault(day, {"date": day, "requests": 0, "errors": 0})
        d["requests"] += 1
        if r.status_code >= 400:
            d["errors"] += 1

        e = per_route.setdefault(
            r.route, {"route": r.route, "requests": 0, "errors": 0, "latencies": []}
        )
        e["requests"] += 1
        if r.status_code >= 400:
            e["errors"] += 1
        if r.latency_ms:
            e["latencies"].append(r.latency_ms)

    endpoints = []
    for e in sorted(per_route.values(), key=lambda x: -x["requests"]):
        lat = sorted(e.pop("latencies"))
        e["p50_ms"] = lat[len(lat) // 2] if lat else None
        endpoints.append(e)

    status_breakdown: dict[str, int] = {}
    for r in rows:
        bucket = f"{r.status_code // 100}xx"
        status_breakdown[bucket] = status_breakdown.get(bucket, 0) + 1

    traces = [
        t for t in _traces_since(db, key.tenant_id, since) if t.api_key_id == key.id
    ]

    return {
        "window_days": days,
        "totals": {
            "requests": len(rows),
            "errors": sum(1 for r in rows if r.status_code >= 400),
            "questions": len(traces),
            "cost_usd": round(sum(t.cost_usd or 0.0 for t in traces), 6),
            "input_tokens": sum(t.input_tokens or 0 for t in traces),
            "output_tokens": sum(t.output_tokens or 0 for t in traces),
        },
        "per_day": [per_day[d] for d in sorted(per_day)],
        "endpoints": endpoints,
        "status_breakdown": status_breakdown,
        "recent": [
            {
                "request_id": r.request_id,
                "method": r.method,
                "route": r.route,
                "status_code": r.status_code,
                "error_code": r.error_code,
                "latency_ms": r.latency_ms,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows[:20]
        ],
    }


def tenant_api_stats(
    db: Session, tenant_id: uuid.UUID, days: int = 14, include_test: bool = False
) -> dict:
    """The Analytics page's "Programmatic access" section."""
    since = _since(days)

    rows = db.scalars(
        select(ApiRequest)
        .where(ApiRequest.tenant_id == tenant_id, ApiRequest.created_at >= since)
    ).all()
    traces = _traces_since(db, tenant_id, since)

    if not include_test:
        rows = [r for r in rows if r.environment != "test"]
        traces = [t for t in traces if t.environment != "test"]

    # `ok` only, to match /stats/analytics. Counting errors here made the
    # channel split (29 app + 40 api) disagree with the headline question
    # count (66) on the very same screen.
    traces = [t for t in traces if t.status == "ok"]
    api_traces = [t for t in traces if t.channel == "api"]
    app_traces = [t for t in traces if t.channel != "api"]

    per_day: dict[str, dict] = {}
    for r in rows:
        day = r.created_at.date().isoformat() if r.created_at else "unknown"
        d = per_day.setdefault(day, {"date": day, "requests": 0, "errors": 0})
        d["requests"] += 1
        if r.status_code >= 400:
            d["errors"] += 1

    per_route: dict[str, dict] = {}
    for r in rows:
        e = per_route.setdefault(r.route, {"route": r.route, "requests": 0, "errors": 0})
        e["requests"] += 1
        if r.status_code >= 400:
            e["errors"] += 1

    status_breakdown: dict[str, int] = {}
    for r in rows:
        bucket = f"{r.status_code // 100}xx"
        status_breakdown[bucket] = status_breakdown.get(bucket, 0) + 1

    keys = db.scalars(select(ApiKey).where(ApiKey.tenant_id == tenant_id)).all()
    by_key_requests: dict[uuid.UUID, int] = {}
    for r in rows:
        if r.api_key_id:
            by_key_requests[r.api_key_id] = by_key_requests.get(r.api_key_id, 0) + 1

    return {
        "window_days": days,
        "include_test": include_test,
        "totals": {
            "requests": len(rows),
            "errors": sum(1 for r in rows if r.status_code >= 400),
            "questions": len(api_traces),
            # Cost read from query_traces, never from api_requests — this is
            # what stops the API section double-counting the workspace total.
            "cost_usd": round(sum(t.cost_usd or 0.0 for t in api_traces), 6),
        },
        "channel_split": {
            "app_questions": len(app_traces),
            "api_questions": len(api_traces),
            "app_cost_usd": round(sum(t.cost_usd or 0.0 for t in app_traces), 6),
            "api_cost_usd": round(sum(t.cost_usd or 0.0 for t in api_traces), 6),
        },
        "per_day": [per_day[d] for d in sorted(per_day)],
        "endpoints": sorted(per_route.values(), key=lambda x: -x["requests"])[:8],
        "status_breakdown": status_breakdown,
        "by_key": [
            {
                "id": str(k.id),
                "name": k.name,
                "environment": k.environment,
                "requests": by_key_requests.get(k.id, 0),
            }
            for k in keys
            if by_key_requests.get(k.id, 0) > 0
        ],
    }


def prune(db: Session, retention_days: int) -> int:
    """Delete api_requests older than the retention window.

    This is the fastest-growing table the platform has, on a free Postgres
    tier. Aggregates beyond the window come from query_traces, which is small.
    """
    from sqlalchemy import delete

    cutoff = _since(retention_days)
    # synchronize_session=False keeps this a single DELETE. The default would
    # pull matching rows into the session to expire them — the exact thing a
    # pruning job must not do on the biggest table in the database.
    # Safe to compare in SQL here (unlike query_traces): api_requests stamps
    # created_at client-side, so the stored values are always tz-aware.
    result = db.execute(
        delete(ApiRequest)
        .where(ApiRequest.created_at < cutoff)
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return result.rowcount or 0
