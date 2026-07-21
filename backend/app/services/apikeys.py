"""API key generation, hashing, scopes and audit (PHASE_11 §1.3–1.4).

The plaintext key is returned exactly once, by the create route. Everything
afterwards works off `sha256(key)`, which is what the database stores.
"""

from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ApiKey, ApiKeyEvent

# ── Scopes: RBAC for machines ────────────────────────────────────────────────
# `actions:write` is the important one — it is the programmatic equivalent of
# require_manager. A key without it produces an agent session where the
# Company MCP tools are never discovered, exactly as for an employee.
SCOPES: dict[str, str] = {
    "ask:write": "Ask questions and get grounded, cited answers.",
    "search:read": "Search the workspace's knowledge without calling a model.",
    "documents:read": "List documents and read ingestion status.",
    "documents:write": "Upload, ingest and delete documents.",
    "actions:write": "Let the agent act in the company's systems over MCP.",
    "analytics:read": "Read this key's own usage and cost.",
}

DEFAULT_SCOPES = ("ask:write", "search:read", "documents:read")
ENVIRONMENTS = ("live", "test")

# How stale last_used_at may get before we spend a write refreshing it.
LAST_USED_REFRESH_SECONDS = 60

_KEY_BYTES = 24  # 192 bits → 32 url-safe characters


def hash_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def generate_key(environment: str) -> tuple[str, str, str, str]:
    """Returns (plaintext, prefix, last4, key_hash)."""
    prefix = f"bsk_{environment}"
    plaintext = f"{prefix}_{secrets.token_urlsafe(_KEY_BYTES)}"
    return plaintext, prefix, plaintext[-4:], hash_key(plaintext)


def looks_like_api_key(token: str) -> bool:
    return token.startswith("bsk_")


def parse_scopes(raw: str | None) -> frozenset[str]:
    return frozenset(s for s in (raw or "").split(",") if s)


def role_for_scopes(scopes: frozenset[str]) -> str:
    """A key's effective role, derived from its scopes — one source of truth.

    Capability follows the scope: only `actions:write` gets a session that
    connects to the Company MCP Server (PROJECT_GUIDE §2.12).
    """
    return "manager" if "actions:write" in scopes else "employee"


def aware(value: datetime | None) -> datetime | None:
    """SQLite hands back naive datetimes; Postgres hands back aware ones."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def find_by_plaintext(db: Session, plaintext: str) -> ApiKey | None:
    return db.scalar(select(ApiKey).where(ApiKey.key_hash == hash_key(plaintext)))


def is_expired(key: ApiKey) -> bool:
    expires = aware(key.expires_at)
    return expires is not None and expires < datetime.now(timezone.utc)


def touch_last_used(db: Session, key: ApiKey) -> None:
    """Refresh last_used_at, at most once a minute — this runs on the hot
    path of every API call, and the display only needs minute resolution."""
    now = datetime.now(timezone.utc)
    last = aware(key.last_used_at)
    if last is not None and (now - last).total_seconds() < LAST_USED_REFRESH_SECONDS:
        return
    try:
        key.last_used_at = now
        db.commit()
    except Exception:
        db.rollback()  # bookkeeping must never fail a request


def record_event(
    db: Session,
    key: ApiKey,
    action: str,
    actor_user_id: uuid.UUID | None,
    detail: dict | None = None,
    ip: str | None = None,
) -> None:
    db.add(
        ApiKeyEvent(
            tenant_id=key.tenant_id,
            api_key_id=key.id,
            actor_user_id=actor_user_id,
            action=action,
            detail=json.dumps(detail) if detail else None,
            ip=ip,
        )
    )
