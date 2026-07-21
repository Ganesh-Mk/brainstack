"""Phase 11a — API keys: minting, scopes, revocation, the /v1 seam.

The most valuable test in this file is `test_key_cannot_reach_another_tenant`:
it re-runs the isolation invariant at the new authentication boundary. A key
is a long-lived credential that resolves its own tenant, so if that resolution
were ever driven by the caller, every other guarantee in the platform would
be worth nothing.
"""

import uuid

from fastapi import Depends

from tests.conftest import auth_header, signup

CREATE = {
    "name": "Prod ingest worker",
    "environment": "live",
    "scopes": ["ask:write", "search:read", "documents:read"],
}


def admin_token(client, company="Lovely", email="admin@lovely.com"):
    return signup(client, company, "Admin", email).json()["access_token"]


def make_key(client, token, **overrides):
    body = {**CREATE, **overrides}
    r = client.post("/api-keys", json=body, headers=auth_header(token))
    assert r.status_code == 201, r.text
    return r.json()


def key_header(plaintext: str) -> dict:
    return {"Authorization": f"Bearer {plaintext}"}


# ── minting ──────────────────────────────────────────────────────────────────


def test_create_returns_plaintext_exactly_once(client):
    token = admin_token(client)
    created = make_key(client, token)

    assert created["key"].startswith("bsk_live_")
    assert created["last4"] == created["key"][-4:]
    assert created["masked"] == f"bsk_live_{'•' * 8}{created['last4']}"
    assert created["active"] is True

    # ...and never again, from any other route.
    listed = client.get("/api-keys", headers=auth_header(token)).json()
    assert len(listed) == 1
    assert "key" not in listed[0]
    assert created["key"] not in str(listed)


def test_hash_is_never_exposed(client):
    token = admin_token(client)
    created = make_key(client, token)
    blob = str(created) + str(client.get("/api-keys", headers=auth_header(token)).json())
    assert "key_hash" not in blob
    assert "hash" not in blob


def test_unknown_scope_is_rejected(client):
    token = admin_token(client)
    r = client.post(
        "/api-keys",
        json={**CREATE, "scopes": ["ask:write", "everything:always"]},
        headers=auth_header(token),
    )
    assert r.status_code == 422
    assert "everything:always" in r.json()["detail"]


def test_empty_scopes_rejected(client):
    token = admin_token(client)
    r = client.post(
        "/api-keys", json={**CREATE, "scopes": []}, headers=auth_header(token)
    )
    assert r.status_code == 422


def test_non_admin_cannot_manage_keys(client):
    admin = admin_token(client)
    invite = client.post(
        "/auth/invites",
        json={"email": "emp@lovely.com", "role": "employee"},
        headers=auth_header(admin),
    ).json()
    employee = client.post(
        f"/auth/invites/{invite['token']}/accept",
        json={"name": "Emp", "password": "password123"},
    ).json()["access_token"]

    assert client.get("/api-keys", headers=auth_header(employee)).status_code == 403
    assert (
        client.post("/api-keys", json=CREATE, headers=auth_header(employee)).status_code
        == 403
    )
    created = make_key(client, admin)
    assert (
        client.post(
            f"/api-keys/{created['id']}/revoke", headers=auth_header(employee)
        ).status_code
        == 403
    )


def test_key_cap_per_tenant(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "API_KEY_MAX_PER_TENANT", 2)
    token = admin_token(client)
    make_key(client, token)
    make_key(client, token)
    r = client.post("/api-keys", json=CREATE, headers=auth_header(token))
    assert r.status_code == 409

    # Revoking frees a slot — the cap counts live keys, not rows.
    keys = client.get("/api-keys", headers=auth_header(token)).json()
    client.post(f"/api-keys/{keys[0]['id']}/revoke", headers=auth_header(token))
    assert client.post("/api-keys", json=CREATE, headers=auth_header(token)).status_code == 201


# ── the /v1 seam ─────────────────────────────────────────────────────────────


def test_v1_me_identifies_the_key(client):
    token = admin_token(client)
    created = make_key(client, token)

    r = client.get("/v1/me", headers=key_header(created["key"]))
    assert r.status_code == 200
    body = r.json()
    assert body["key_id"] == created["id"]
    assert body["name"] == "Prod ingest worker"
    assert body["environment"] == "live"
    assert body["tenant"]["name"] == "Lovely"
    assert sorted(body["scopes"]) == sorted(CREATE["scopes"])
    assert created["key"] not in str(body)  # introspection never re-reveals it


def test_v1_rejects_missing_bad_and_session_tokens(client):
    session = admin_token(client)

    for headers in (
        {},
        key_header("bsk_live_totally-made-up"),
        key_header("not-even-a-key"),
        auth_header(session),  # a valid JWT is NOT an API key
    ):
        r = client.get("/v1/me", headers=headers)
        assert r.status_code == 401, headers
        assert r.json()["code"] == "invalid_api_key"
        assert r.json()["request_id"]


def test_api_key_cannot_reach_internal_routes(client):
    """The reason API keys got their own dependency: a key must not inherit
    the session surface (members, stats, documents)."""
    token = admin_token(client)
    created = make_key(client, token)
    h = key_header(created["key"])

    for path in ("/auth/me", "/auth/members", "/stats/analytics", "/documents"):
        assert client.get(path, headers=h).status_code == 401, path


def test_revoked_key_is_rejected_immediately(client):
    token = admin_token(client)
    created = make_key(client, token)
    h = key_header(created["key"])
    assert client.get("/v1/me", headers=h).status_code == 200

    r = client.post(f"/api-keys/{created['id']}/revoke", headers=auth_header(token))
    assert r.status_code == 200
    assert r.json()["active"] is False

    r = client.get("/v1/me", headers=h)
    assert r.status_code == 401
    assert r.json()["code"] == "key_revoked"


def test_revoke_is_idempotent(client):
    token = admin_token(client)
    created = make_key(client, token)
    first = client.post(f"/api-keys/{created['id']}/revoke", headers=auth_header(token))
    second = client.post(f"/api-keys/{created['id']}/revoke", headers=auth_header(token))
    assert second.status_code == 200
    assert second.json()["revoked_at"] == first.json()["revoked_at"]


def test_expired_key_is_rejected(client):
    from datetime import datetime, timedelta, timezone

    import app.db as app_db
    from app.models import ApiKey

    token = admin_token(client)
    created = make_key(client, token, expires_in_days=1)

    session = app_db.SessionLocal()
    key = session.get(ApiKey, uuid.UUID(created["id"]))
    key.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    session.commit()
    session.close()

    r = client.get("/v1/me", headers=key_header(created["key"]))
    assert r.status_code == 401
    assert r.json()["code"] == "key_expired"


def test_revoke_across_tenants_is_404(client):
    a = admin_token(client, "Lovely", "ada@lovely.com")
    b = admin_token(client, "Rival", "bob@rival.com")
    created = make_key(client, a)

    # 404, not 403 — never confirm another workspace's ids exist.
    r = client.post(f"/api-keys/{created['id']}/revoke", headers=auth_header(b))
    assert r.status_code == 404


def test_key_cannot_reach_another_tenant(client):
    """The isolation invariant, re-run at the API-key boundary.

    A key resolves its own tenant from its own row. Nothing the caller sends
    can move it, so tenant B's key sees only tenant B.
    """
    a = admin_token(client, "Lovely", "ada@lovely.com")
    b = admin_token(client, "Rival", "bob@rival.com")
    key_a = make_key(client, a)
    key_b = make_key(client, b)

    me_a = client.get("/v1/me", headers=key_header(key_a["key"])).json()
    me_b = client.get("/v1/me", headers=key_header(key_b["key"])).json()

    assert me_a["tenant"]["name"] == "Lovely"
    assert me_b["tenant"]["name"] == "Rival"
    assert me_a["tenant"]["id"] != me_b["tenant"]["id"]
    assert me_a["key_id"] != me_b["key_id"]

    # Neither workspace can even see the other's key in management routes.
    listed_a = client.get("/api-keys", headers=auth_header(a)).json()
    assert [k["id"] for k in listed_a] == [key_a["id"]]


# ── scopes ───────────────────────────────────────────────────────────────────


def test_require_scope_gates_a_route(client):
    """`require_scope` is the machine equivalent of require_manager. Exercised
    against a throwaway route so it is tested independently of 11b's surface."""
    from app.core.principal import Principal, require_scope
    from app.main import app

    @app.get("/v1/_scope_probe")
    def _probe(p: Principal = Depends(require_scope("documents:write"))):
        return {"tenant": str(p.tenant_id)}

    try:
        token = admin_token(client)
        readonly = make_key(client, token, scopes=["search:read"])
        writer = make_key(client, token, name="w", scopes=["documents:write"])

        r = client.get("/v1/_scope_probe", headers=key_header(readonly["key"]))
        assert r.status_code == 403
        assert r.json()["code"] == "insufficient_scope"
        assert r.json()["required"] == "documents:write"

        r = client.get("/v1/_scope_probe", headers=key_header(writer["key"]))
        assert r.status_code == 200
    finally:
        app.router.routes[:] = [
            r
            for r in app.router.routes
            if getattr(r, "path", None) != "/v1/_scope_probe"
        ]


def test_actions_scope_decides_the_effective_role(client):
    """Capability follows the scope: only `actions:write` yields a session
    that would connect to the Company MCP Server (PROJECT_GUIDE §2.12)."""
    token = admin_token(client)
    plain = make_key(client, token, scopes=["ask:write"])
    acting = make_key(client, token, name="ops", scopes=["ask:write", "actions:write"])

    assert client.get("/v1/me", headers=key_header(plain["key"])).json()["role"] == (
        "employee"
    )
    assert client.get("/v1/me", headers=key_header(acting["key"])).json()["role"] == (
        "manager"
    )


def test_catalog_drives_the_create_form(client):
    token = admin_token(client)
    body = client.get("/api-keys/catalog", headers=auth_header(token)).json()
    assert {s["scope"] for s in body["scopes"]} == {
        "ask:write",
        "search:read",
        "documents:read",
        "documents:write",
        "actions:write",
        "analytics:read",
    }
    assert body["environments"] == ["live", "test"]
    assert body["default_scopes"]


def test_test_environment_gets_its_own_prefix(client):
    token = admin_token(client)
    created = make_key(client, token, environment="test")
    assert created["key"].startswith("bsk_test_")
    assert created["prefix"] == "bsk_test"
    assert (
        client.get("/v1/me", headers=key_header(created["key"])).json()["environment"]
        == "test"
    )


# ── audit ────────────────────────────────────────────────────────────────────


def test_audit_records_creation_and_revocation(client):
    token = admin_token(client)
    created = make_key(client, token)
    client.post(f"/api-keys/{created['id']}/revoke", headers=auth_header(token))

    events = client.get("/api-keys/audit", headers=auth_header(token)).json()
    # Set, not sequence: two events raised inside one burst can share a
    # timestamp (`datetime.now()` is ~15ms-granular on Windows). Ordering is
    # asserted separately, below, with timestamps that genuinely differ.
    assert {e["action"] for e in events} == {"created", "revoked"}
    assert all(e["api_key_id"] == created["id"] for e in events)
    assert all(e["actor_user_id"] for e in events)
    detail = next(e["detail"] for e in events if e["action"] == "created")
    assert "Prod ingest worker" in detail


def test_audit_is_newest_first(client):
    """The ORDER BY, tested with timestamps that actually differ."""
    from datetime import datetime, timedelta, timezone

    import app.db as app_db
    from app.models import ApiKeyEvent

    token = admin_token(client)
    created = make_key(client, token)
    client.post(f"/api-keys/{created['id']}/revoke", headers=auth_header(token))

    session = app_db.SessionLocal()
    now = datetime.now(timezone.utc)
    for i, row in enumerate(
        session.query(ApiKeyEvent).order_by(ApiKeyEvent.action.asc()).all()
    ):
        # 'created' sorts first alphabetically → give it the older timestamp.
        row.created_at = now - timedelta(minutes=10 - i)
    session.commit()
    session.close()

    events = client.get("/api-keys/audit", headers=auth_header(token)).json()
    assert [e["action"] for e in events] == ["revoked", "created"]


def test_audit_is_tenant_scoped(client):
    a = admin_token(client, "Lovely", "ada@lovely.com")
    b = admin_token(client, "Rival", "bob@rival.com")
    make_key(client, a)
    assert client.get("/api-keys/audit", headers=auth_header(b)).json() == []


# ── last_used_at ─────────────────────────────────────────────────────────────


def test_last_used_is_recorded(client):
    token = admin_token(client)
    created = make_key(client, token)
    assert created["last_used_at"] is None

    client.get("/v1/me", headers=key_header(created["key"]))
    listed = client.get("/api-keys", headers=auth_header(token)).json()[0]
    assert listed["last_used_at"] is not None
