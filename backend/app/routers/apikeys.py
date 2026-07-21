"""Key management — session-authenticated, admin-only (PHASE_11 §3).

These are NOT `/v1` routes: they are the product's own settings surface, the
same as /auth/members. Minting a credential that can read the entire corpus
is an admin act, so `require_admin` gates every route here.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import CurrentUser, require_admin
from app.db import get_db
from app.models import ApiKey, ApiKeyEvent
from app.schemas.apikeys import (
    ApiKeyCatalog,
    ApiKeyCreated,
    ApiKeyCreateRequest,
    ApiKeyEventOut,
    ApiKeyOut,
    ScopeOut,
)
from app.services import apikeys, apiusage, usage

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


def _masked(key: ApiKey) -> str:
    return f"{key.prefix}_{'•' * 8}{key.last4}"


def _to_out(key: ApiKey) -> ApiKeyOut:
    return ApiKeyOut(
        id=key.id,
        name=key.name,
        environment=key.environment,
        prefix=key.prefix,
        last4=key.last4,
        masked=_masked(key),
        scopes=sorted(apikeys.parse_scopes(key.scopes)),
        created_by_user_id=key.created_by_user_id,
        created_at=key.created_at,
        expires_at=key.expires_at,
        last_used_at=key.last_used_at,
        revoked_at=key.revoked_at,
        rate_limit_per_hour=key.rate_limit_per_hour,
        monthly_cost_cap_usd=key.monthly_cost_cap_usd,
        active=key.revoked_at is None and not apikeys.is_expired(key),
    )


def _owned(key_id: uuid.UUID, current: CurrentUser, db: Session) -> ApiKey:
    key = db.get(ApiKey, key_id)
    # 404, not 403, across tenants — never confirm another workspace's ids.
    if key is None or key.tenant_id != current.tenant_id:
        raise HTTPException(status_code=404, detail="API key not found")
    return key


@router.get("/catalog", response_model=ApiKeyCatalog)
def catalog(current: CurrentUser = Depends(require_admin)) -> ApiKeyCatalog:
    settings = get_settings()
    return ApiKeyCatalog(
        scopes=[ScopeOut(scope=s, description=d) for s, d in apikeys.SCOPES.items()],
        environments=list(apikeys.ENVIRONMENTS),
        default_scopes=list(apikeys.DEFAULT_SCOPES),
        default_rate_limit_per_hour=settings.API_KEY_DEFAULT_RATE_LIMIT_PER_HOUR,
        max_keys_per_tenant=settings.API_KEY_MAX_PER_TENANT,
    )


@router.get("", response_model=list[ApiKeyOut])
def list_keys(
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[ApiKeyOut]:
    rows = list(
        db.scalars(
            select(ApiKey)
            .where(ApiKey.tenant_id == current.tenant_id)
            .order_by(ApiKey.created_at.desc())
        )
    )
    # Two aggregate queries for the whole table, not one per row.
    rollup = apiusage.key_rollup(db, current.tenant_id, days=7)
    out = []
    for k in rows:
        item = _to_out(k)
        stats = rollup.get(k.id)
        if stats:
            item.requests_7d = stats["requests"]
            item.errors_7d = stats["errors"]
            item.cost_usd_7d = stats["cost_usd"]
        out.append(item)
    return out


@router.get("/{key_id}/usage")
def key_usage(
    key_id: uuid.UUID,
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    key = _owned(key_id, current, db)
    detail = apiusage.key_detail(db, key)
    detail["spend_this_month_usd"] = round(usage.month_to_date(db, key.id), 6)
    detail["monthly_cost_cap_usd"] = key.monthly_cost_cap_usd
    return detail


@router.post("", response_model=ApiKeyCreated, status_code=201)
def create_key(
    body: ApiKeyCreateRequest,
    request: Request,
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ApiKeyCreated:
    settings = get_settings()

    unknown = sorted(set(body.scopes) - set(apikeys.SCOPES))
    if unknown:
        raise HTTPException(
            status_code=422, detail=f"Unknown scope(s): {', '.join(unknown)}"
        )

    live = db.scalars(
        select(ApiKey).where(
            ApiKey.tenant_id == current.tenant_id, ApiKey.revoked_at.is_(None)
        )
    ).all()
    if len(live) >= settings.API_KEY_MAX_PER_TENANT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"This workspace already has {settings.API_KEY_MAX_PER_TENANT} "
                "active keys. Revoke one before creating another."
            ),
        )

    plaintext, prefix, last4, key_hash = apikeys.generate_key(body.environment)
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)
        if body.expires_in_days
        else None
    )
    key = ApiKey(
        tenant_id=current.tenant_id,
        name=body.name,
        environment=body.environment,
        prefix=prefix,
        last4=last4,
        key_hash=key_hash,
        scopes=",".join(sorted(set(body.scopes))),
        created_by_user_id=current.user.id,
        expires_at=expires_at,
        rate_limit_per_hour=(
            body.rate_limit_per_hour
            if body.rate_limit_per_hour is not None
            else settings.API_KEY_DEFAULT_RATE_LIMIT_PER_HOUR
        ),
        monthly_cost_cap_usd=body.monthly_cost_cap_usd,
    )
    db.add(key)
    db.flush()
    apikeys.record_event(
        db,
        key,
        "created",
        current.user.id,
        detail={
            "name": key.name,
            "environment": key.environment,
            "scopes": sorted(set(body.scopes)),
        },
        ip=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(key)

    # The one and only time the plaintext leaves this process.
    return ApiKeyCreated(**_to_out(key).model_dump(), key=plaintext)


@router.post("/{key_id}/revoke", response_model=ApiKeyOut)
def revoke_key(
    key_id: uuid.UUID,
    request: Request,
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ApiKeyOut:
    key = _owned(key_id, current, db)
    if key.revoked_at is not None:
        return _to_out(key)  # idempotent — revoking twice is not an error
    key.revoked_at = datetime.now(timezone.utc)
    key.revoked_by_user_id = current.user.id
    apikeys.record_event(
        db,
        key,
        "revoked",
        current.user.id,
        detail={"name": key.name},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(key)
    return _to_out(key)


@router.get("/audit", response_model=list[ApiKeyEventOut])
def audit(
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[ApiKeyEventOut]:
    rows = db.scalars(
        select(ApiKeyEvent)
        .where(ApiKeyEvent.tenant_id == current.tenant_id)
        # id is the tiebreaker so paging is stable: `datetime.now()` has
        # ~15ms granularity on Windows, so two events in one burst can share
        # a timestamp and would otherwise come back in arbitrary order.
        .order_by(ApiKeyEvent.created_at.desc(), ApiKeyEvent.id.desc())
        .limit(100)
    )
    return [
        ApiKeyEventOut(
            id=e.id,
            api_key_id=e.api_key_id,
            actor_user_id=e.actor_user_id,
            action=e.action,
            detail=e.detail,
            created_at=e.created_at,
        )
        for e in rows
    ]
