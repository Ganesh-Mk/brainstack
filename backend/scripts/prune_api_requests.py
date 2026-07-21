"""Delete api_requests rows past the retention window (PHASE_11 §2).

`api_requests` is the fastest-growing table this platform has — one row per
/v1 call, on a free Postgres tier. Aggregates beyond the window still work,
because they come from query_traces, which stays small.

    python scripts/prune_api_requests.py            # uses API_REQUEST_RETENTION_DAYS
    python scripts/prune_api_requests.py --days 30
    python scripts/prune_api_requests.py --dry-run

Run it daily: Celery beat in the compose stack, or a platform cron elsewhere.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datetime import datetime, timedelta, timezone  # noqa: E402

from sqlalchemy import func, select  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models import ApiRequest  # noqa: E402
from app.services import apiusage  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    days = args.days or get_settings().API_REQUEST_RETENTION_DAYS
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    session = SessionLocal()
    try:
        total = session.scalar(select(func.count()).select_from(ApiRequest))
        stale = session.scalar(
            select(func.count())
            .select_from(ApiRequest)
            .where(ApiRequest.created_at < cutoff)
        )
        print(f"api_requests: {total} rows, {stale} older than {days} days")
        if args.dry_run:
            print("dry run — nothing deleted")
            return 0
        deleted = apiusage.prune(session, days)
        print(f"deleted {deleted} rows")
    finally:
        session.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
