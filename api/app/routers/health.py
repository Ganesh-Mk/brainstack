from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    out = {"status": "ok", "db": "down", "redis": "down"}

    db.execute(text("select 1"))
    out["db"] = "ok"

    settings = get_settings()
    if settings.REDIS_URL:
        import redis

        r = redis.from_url(settings.REDIS_URL, socket_timeout=5)
        r.ping()
        out["redis"] = "ok"
    else:
        out["redis"] = "not configured"

    return out
