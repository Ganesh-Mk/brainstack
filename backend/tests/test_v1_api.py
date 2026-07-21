"""Phase 11b–11d — the public API surface, and the accountability behind it.

The two that matter most:
  * `test_key_cannot_search_another_tenants_corpus` — the isolation invariant
    at the /v1 boundary, on the retrieval path where a leak would be silent.
  * `test_metering_survives_a_broken_ledger` — metering must never break a
    response. If accountability can take the product down, it will be turned
    off, and then there is no accountability.
"""

import uuid

import pytest

from tests.conftest import auth_header, signup

CREATE = {
    "name": "Integration",
    "environment": "live",
    "scopes": [
        "ask:write",
        "search:read",
        "documents:read",
        "documents:write",
        "analytics:read",
    ],
}


def admin_token(client, company="Lovely", email="admin@lovely.com"):
    return signup(client, company, "Admin", email).json()["access_token"]


def make_key(client, token, **overrides):
    r = client.post("/api-keys", json={**CREATE, **overrides}, headers=auth_header(token))
    assert r.status_code == 201, r.text
    return r.json()


def key_header(plaintext: str) -> dict:
    return {"Authorization": f"Bearer {plaintext}"}


class FakeSource:
    """Mirrors chat.Source's shape without touching Pinecone."""

    def __init__(self, n, text, title="policies", doc="d1"):
        self.n, self.text, self.title = n, text, title
        self.document_id, self.page, self.score = doc, 7, 0.9
        self.source_type, self.source_url = "pdf", None

    def to_dict(self):
        return {
            "n": self.n,
            "document_id": self.document_id,
            "title": self.title,
            "page": self.page,
            "text": self.text,
            "score": self.score,
            "source_type": self.source_type,
            "source_url": self.source_url,
        }


@pytest.fixture
def fake_retrieval(monkeypatch):
    """Per-tenant corpora, so a cross-tenant leak would be visible."""
    from app.services import chat as chat_mod

    corpus: dict[str, list] = {}

    def fake_retrieve(db, tenant_id, question):
        return [
            FakeSource(i + 1, t)
            for i, t in enumerate(corpus.get(str(tenant_id), []))
        ]

    monkeypatch.setattr(chat_mod, "retrieve", fake_retrieve, raising=True)
    return corpus


@pytest.fixture
def fake_answer(monkeypatch):
    """Replace the graph run with a deterministic outcome — /v1 plumbing is
    what's under test here, not the agent (test_agent.py owns that)."""
    from app.services import ask as ask_mod

    def fake_run(state):
        yield ("trace", {"n": 1, "kind": "knowledge", "label": "Searching knowledge"})
        yield ("sources", [FakeSource(1, "Refunds within 30 days.").to_dict()])
        yield ("delta", {"text": "Refunds are allowed within 30 days [1]."})
        return ask_mod.AskOutcome(
            answer="Refunds are allowed within 30 days [1].",
            sources=[FakeSource(1, "Refunds within 30 days.").to_dict()],
            trace=[
                {"n": 1, "kind": "knowledge", "label": "Searching knowledge"},
                {"n": 2, "kind": "drafting", "label": "Drafting the answer", "ms": 5},
            ],
            input_tokens=1200,
            output_tokens=80,
            cost_usd=0.0016,
            first_token_ms=210,
            latency_ms=900,
            model="claude-haiku-4-5",
        )

    monkeypatch.setattr(ask_mod, "run", fake_run, raising=True)
    monkeypatch.setattr(
        __import__("app.config", fromlist=["get_settings"]).get_settings(),
        "ANTHROPIC_API_KEY",
        "test-key",
    )


# ── /v1/search ───────────────────────────────────────────────────────────────


def test_search_returns_ranked_passages(client, fake_retrieval):
    token = admin_token(client)
    key = make_key(client, token)
    me = client.get("/v1/me", headers=key_header(key["key"])).json()
    fake_retrieval[me["tenant"]["id"]] = ["Refunds within 30 days.", "Enterprise: 60."]

    r = client.post(
        "/v1/search", json={"query": "refund policy"}, headers=key_header(key["key"])
    )
    assert r.status_code == 200
    body = r.json()
    assert [s["n"] for s in body["results"]] == [1, 2]
    assert body["results"][0]["text"].startswith("Refunds")
    assert body["latency_ms"] >= 0


def test_search_respects_top_k_and_renumbers(client, fake_retrieval):
    token = admin_token(client)
    key = make_key(client, token)
    me = client.get("/v1/me", headers=key_header(key["key"])).json()
    fake_retrieval[me["tenant"]["id"]] = ["a", "b", "c", "d"]

    body = client.post(
        "/v1/search",
        json={"query": "x", "top_k": 2},
        headers=key_header(key["key"]),
    ).json()
    assert [s["n"] for s in body["results"]] == [1, 2]


def test_search_needs_its_scope(client, fake_retrieval):
    token = admin_token(client)
    key = make_key(client, token, scopes=["ask:write"])
    r = client.post("/v1/search", json={"query": "x"}, headers=key_header(key["key"]))
    assert r.status_code == 403
    assert r.json()["code"] == "insufficient_scope"


def test_key_cannot_search_another_tenants_corpus(client, fake_retrieval):
    """Isolation on the retrieval path — where a leak would be paraphrased
    into a fluent, cited answer and nobody would notice."""
    a = admin_token(client, "Lovely", "ada@lovely.com")
    b = admin_token(client, "Rival", "bob@rival.com")
    key_a, key_b = make_key(client, a), make_key(client, b)

    me_a = client.get("/v1/me", headers=key_header(key_a["key"])).json()
    me_b = client.get("/v1/me", headers=key_header(key_b["key"])).json()
    fake_retrieval[me_a["tenant"]["id"]] = ["LOVELY SECRET: margin is 42%."]
    fake_retrieval[me_b["tenant"]["id"]] = ["RIVAL SECRET: margin is 11%."]

    body_b = client.post(
        "/v1/search", json={"query": "margin"}, headers=key_header(key_b["key"])
    ).json()
    text = str(body_b)
    assert "RIVAL SECRET" in text
    assert "LOVELY SECRET" not in text


# ── /v1/ask ──────────────────────────────────────────────────────────────────


def test_ask_returns_answer_sources_and_usage(client, fake_answer):
    token = admin_token(client)
    key = make_key(client, token)

    r = client.post(
        "/v1/ask", json={"question": "refund policy?"}, headers=key_header(key["key"])
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["answer"].startswith("Refunds are allowed")
    assert body["sources"][0]["n"] == 1
    assert body["usage"]["input_tokens"] == 1200
    assert body["usage"]["cost_usd"] == 0.0016
    assert body["conversation_id"]
    assert body["trace_id"]


def test_ask_continues_a_conversation(client, fake_answer):
    token = admin_token(client)
    key = make_key(client, token)
    h = key_header(key["key"])

    first = client.post("/v1/ask", json={"question": "one"}, headers=h).json()
    second = client.post(
        "/v1/ask",
        json={"question": "two", "conversation_id": first["conversation_id"]},
        headers=h,
    ).json()
    assert second["conversation_id"] == first["conversation_id"]

    # The turns are persisted, and visible to the human who owns the key.
    detail = client.get(
        f"/conversations/{first['conversation_id']}", headers=auth_header(token)
    ).json()
    assert [m["content"] for m in detail["messages"]][::2] == ["one", "two"]


def test_ask_rejects_another_tenants_conversation(client, fake_answer):
    a = admin_token(client, "Lovely", "ada@lovely.com")
    b = admin_token(client, "Rival", "bob@rival.com")
    key_a, key_b = make_key(client, a), make_key(client, b)

    convo = client.post(
        "/v1/ask", json={"question": "one"}, headers=key_header(key_a["key"])
    ).json()["conversation_id"]

    r = client.post(
        "/v1/ask",
        json={"question": "two", "conversation_id": convo},
        headers=key_header(key_b["key"]),
    )
    assert r.status_code == 404
    assert r.json()["code"] == "conversation_not_found"


def test_ask_streams_when_asked(client, fake_answer):
    token = admin_token(client)
    key = make_key(client, token)

    with client.stream(
        "POST",
        "/v1/ask",
        json={"question": "refund policy?", "stream": True},
        headers=key_header(key["key"]),
    ) as r:
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")
        body = "".join(r.iter_text())

    assert "event: delta" in body
    assert "event: trace" in body
    assert "event: done" in body
    assert "Refunds are allowed" in body


def test_ask_needs_its_scope(client, fake_answer):
    token = admin_token(client)
    key = make_key(client, token, scopes=["search:read"])
    r = client.post("/v1/ask", json={"question": "x"}, headers=key_header(key["key"]))
    assert r.status_code == 403


def test_ask_writes_an_api_channel_trace(client, fake_answer):
    import app.db as app_db
    from app.models import QueryTrace

    token = admin_token(client)
    key = make_key(client, token)
    client.post(
        "/v1/ask", json={"question": "refund policy?"}, headers=key_header(key["key"])
    )

    session = app_db.SessionLocal()
    trace = session.query(QueryTrace).one()
    session.close()

    assert trace.channel == "api"
    assert trace.environment == "live"
    assert str(trace.api_key_id) == key["id"]
    assert trace.cost_usd == 0.0016
    assert trace.input_tokens == 1200


def test_app_asks_are_still_app_channel(client, monkeypatch):
    """The app route keeps writing channel='app' after the Phase 11 refactor —
    otherwise every existing analytics number silently changes meaning."""
    import app.db as app_db
    from app.models import QueryTrace
    from app.services import ask as ask_mod

    def fake_run(state):
        yield ("delta", {"text": "hi"})
        return ask_mod.AskOutcome(answer="hi", model="m")

    monkeypatch.setattr(ask_mod, "run", fake_run, raising=True)
    monkeypatch.setattr(
        __import__("app.config", fromlist=["get_settings"]).get_settings(),
        "ANTHROPIC_API_KEY",
        "test-key",
    )

    token = admin_token(client)
    convo = client.post("/conversations", headers=auth_header(token)).json()
    with client.stream(
        "POST",
        f"/conversations/{convo['id']}/messages",
        json={"content": "hello"},
        headers=auth_header(token),
    ) as r:
        "".join(r.iter_text())

    session = app_db.SessionLocal()
    trace = session.query(QueryTrace).one()
    session.close()
    assert trace.channel == "app"
    assert trace.api_key_id is None


# ── /v1/documents ────────────────────────────────────────────────────────────

PDF = b"%PDF-1.4\n% minimal\n"


def test_document_lifecycle_over_the_api(client, monkeypatch):
    from app.services import ingestion as ingestion_mod
    from app.services import storage as storage_mod
    from app.services import vectorstore as vectorstore_mod

    monkeypatch.setattr(
        storage_mod, "upload_pdf", lambda t, d, data: f"{t}/{d}.pdf", raising=True
    )
    monkeypatch.setattr(storage_mod, "delete_object", lambda p: None, raising=True)
    monkeypatch.setattr(vectorstore_mod, "delete_ids", lambda ns, ids: None, raising=True)
    monkeypatch.setattr(ingestion_mod, "run_ingestion", lambda doc_id: None, raising=True)

    token = admin_token(client)
    key = make_key(client, token)
    h = key_header(key["key"])

    r = client.post("/v1/documents", files={"file": ("policy.pdf", PDF, "application/pdf")}, headers=h)
    assert r.status_code == 202, r.text
    doc = r.json()
    assert doc["title"] == "policy"
    assert doc["status"] == "queued"

    assert client.get("/v1/documents", headers=h).json()["documents"][0]["id"] == doc["id"]
    assert client.get(f"/v1/documents/{doc['id']}", headers=h).json()["status"] == "queued"
    assert client.delete(f"/v1/documents/{doc['id']}", headers=h).status_code == 204
    assert client.get("/v1/documents", headers=h).json()["documents"] == []


def test_document_upload_validation_shares_the_app_rules(client):
    token = admin_token(client)
    key = make_key(client, token)
    r = client.post(
        "/v1/documents",
        files={"file": ("notes.txt", b"hello", "text/plain")},
        headers=key_header(key["key"]),
    )
    assert r.status_code == 415
    assert r.json()["code"] == "unsupported_media_type"


def test_document_write_needs_its_scope(client):
    token = admin_token(client)
    key = make_key(client, token, scopes=["documents:read"])
    r = client.post(
        "/v1/documents/url",
        json={"url": "https://example.com"},
        headers=key_header(key["key"]),
    )
    assert r.status_code == 403
    assert r.json()["required"] == "documents:write"


def test_documents_are_tenant_scoped(client, monkeypatch):
    from app.services import ingestion as ingestion_mod

    monkeypatch.setattr(ingestion_mod, "run_ingestion", lambda doc_id: None, raising=True)

    a = admin_token(client, "Lovely", "ada@lovely.com")
    b = admin_token(client, "Rival", "bob@rival.com")
    key_a, key_b = make_key(client, a), make_key(client, b)

    doc = client.post(
        "/v1/documents/url",
        json={"url": "https://lovely.example.com/handbook"},
        headers=key_header(key_a["key"]),
    ).json()

    assert client.get("/v1/documents", headers=key_header(key_b["key"])).json()["documents"] == []
    r = client.get(f"/v1/documents/{doc['id']}", headers=key_header(key_b["key"]))
    assert r.status_code == 404
    assert r.json()["code"] == "document_not_found"


# ── metering ─────────────────────────────────────────────────────────────────


def _requests(tenant_filter=None):
    import app.db as app_db
    from app.models import ApiRequest

    session = app_db.SessionLocal()
    rows = session.query(ApiRequest).order_by(ApiRequest.created_at.asc()).all()
    out = [
        {
            "route": r.route,
            "method": r.method,
            "status": r.status_code,
            "error_code": r.error_code,
            "api_key_id": str(r.api_key_id) if r.api_key_id else None,
            "request_id": r.request_id,
            "query_trace_id": r.query_trace_id,
        }
        for r in rows
    ]
    session.close()
    return out


def test_every_v1_call_is_metered(client, fake_retrieval):
    token = admin_token(client)
    key = make_key(client, token)
    client.get("/v1/me", headers=key_header(key["key"]))
    client.post("/v1/search", json={"query": "x"}, headers=key_header(key["key"]))

    rows = _requests()
    assert [r["route"] for r in rows] == ["/v1/me", "/v1/search"]
    assert all(r["status"] == 200 for r in rows)
    assert all(r["api_key_id"] == key["id"] for r in rows)
    assert all(r["request_id"] for r in rows)


def test_rejections_are_metered_too(client):
    """The rows you most need when a credential leaks."""
    token = admin_token(client)
    key = make_key(client, token, scopes=["search:read"])

    client.get("/v1/me", headers=key_header("bsk_live_nonsense"))  # 401
    client.post("/v1/ask", json={"question": "x"}, headers=key_header(key["key"]))  # 403

    rows = _requests()
    assert [(r["status"], r["error_code"]) for r in rows] == [
        (401, "invalid_api_key"),
        (403, "insufficient_scope"),
    ]
    assert rows[0]["api_key_id"] is None  # nothing resolved


def test_request_id_is_echoed_in_header_and_body(client):
    r = client.get("/v1/me", headers=key_header("bsk_live_nope"))
    assert r.headers["X-Request-Id"] == r.json()["request_id"]
    assert _requests()[0]["request_id"] == r.json()["request_id"]


def test_route_template_not_raw_path_is_stored(client, monkeypatch):
    from app.services import ingestion as ingestion_mod

    monkeypatch.setattr(ingestion_mod, "run_ingestion", lambda doc_id: None, raising=True)
    token = admin_token(client)
    key = make_key(client, token)
    doc = client.post(
        "/v1/documents/url",
        json={"url": "https://example.com/x"},
        headers=key_header(key["key"]),
    ).json()
    client.get(f"/v1/documents/{doc['id']}", headers=key_header(key["key"]))

    routes = [r["route"] for r in _requests()]
    assert "/v1/documents/{document_id}" in routes
    assert doc["id"] not in str(routes)


def test_ask_links_the_two_ledgers(client, fake_answer):
    token = admin_token(client)
    key = make_key(client, token)
    body = client.post(
        "/v1/ask", json={"question": "x"}, headers=key_header(key["key"])
    ).json()

    row = [r for r in _requests() if r["route"] == "/v1/ask"][0]
    assert str(row["query_trace_id"]) == body["trace_id"]


def test_streaming_ask_is_metered_after_the_stream(client, fake_answer):
    token = admin_token(client)
    key = make_key(client, token)
    with client.stream(
        "POST",
        "/v1/ask",
        json={"question": "x", "stream": True},
        headers=key_header(key["key"]),
    ) as r:
        "".join(r.iter_text())

    row = [r for r in _requests() if r["route"] == "/v1/ask"][0]
    assert row["status"] == 200
    assert row["query_trace_id"] is not None  # set mid-stream, read at the end


def test_metering_survives_a_broken_ledger(client, monkeypatch, fake_retrieval):
    """Accountability that can break the product gets switched off, and then
    there is no accountability. The write must fail silently."""
    from app.core import metering

    def boom():
        raise RuntimeError("ledger is down")

    monkeypatch.setattr(metering.app_db, "SessionLocal", boom, raising=True)

    token = admin_token(client)
    key = make_key(client, token)
    r = client.post(
        "/v1/search", json={"query": "x"}, headers=key_header(key["key"])
    )
    assert r.status_code == 200  # the answer still lands


def test_app_routes_are_not_metered(client):
    token = admin_token(client)
    client.get("/auth/me", headers=auth_header(token))
    client.get("/conversations", headers=auth_header(token))
    assert _requests() == []


# ── limits and caps ──────────────────────────────────────────────────────────


class FakeRedis:
    def __init__(self):
        self.counts: dict[str, float] = {}

    def incr(self, key):
        self.counts[key] = self.counts.get(key, 0) + 1
        return int(self.counts[key])

    def expire(self, key, ttl):
        return True

    def get(self, key):
        return self.counts.get(key)

    def set(self, key, value, ex=None):
        self.counts[key] = value

    def exists(self, key):
        return key in self.counts

    def incrbyfloat(self, key, amount):
        self.counts[key] = float(self.counts.get(key, 0)) + amount
        return self.counts[key]


@pytest.fixture
def fake_redis(monkeypatch):
    from app.core import ratelimit

    fake = FakeRedis()
    monkeypatch.setattr(ratelimit, "_redis", lambda: fake, raising=True)
    return fake


def test_per_key_rate_limit(client, fake_redis, fake_retrieval):
    token = admin_token(client)
    key = make_key(client, token, rate_limit_per_hour=2)
    h = key_header(key["key"])

    assert client.get("/v1/me", headers=h).status_code == 200
    assert client.get("/v1/me", headers=h).status_code == 200
    r = client.get("/v1/me", headers=h)

    assert r.status_code == 429
    assert r.json()["code"] == "rate_limited"
    assert r.json()["scope_of_limit"] == "key"
    assert r.headers["X-RateLimit-Limit"] == "2"
    assert r.headers["X-RateLimit-Remaining"] == "0"
    assert int(r.headers["Retry-After"]) > 0
    assert _requests()[-1]["error_code"] == "rate_limited"


def test_one_key_does_not_eat_another_keys_budget(client, fake_redis):
    token = admin_token(client)
    slow = make_key(client, token, name="slow", rate_limit_per_hour=1)
    fast = make_key(client, token, name="fast", rate_limit_per_hour=50)

    client.get("/v1/me", headers=key_header(slow["key"]))
    assert client.get("/v1/me", headers=key_header(slow["key"])).status_code == 429
    assert client.get("/v1/me", headers=key_header(fast["key"])).status_code == 200


def test_monthly_cost_cap_blocks_before_spending(client, fake_answer, fake_redis):
    token = admin_token(client)
    key = make_key(client, token, monthly_cost_cap_usd=0.001)
    h = key_header(key["key"])

    # 0.0016 spent per ask: the first is under the cap, the second is refused.
    assert client.post("/v1/ask", json={"question": "one"}, headers=h).status_code == 200
    r = client.post("/v1/ask", json={"question": "two"}, headers=h)
    assert r.status_code == 429
    assert r.json()["code"] == "cost_cap_exceeded"
    assert r.json()["cap_usd"] == 0.001


def test_cost_cap_holds_without_redis(client, fake_answer, monkeypatch):
    """A rate limiter may degrade to a no-op without Redis. A spend ceiling
    must not — it falls back to the traces table."""
    from app.core import ratelimit

    monkeypatch.setattr(ratelimit, "_redis", lambda: None, raising=True)

    token = admin_token(client)
    key = make_key(client, token, monthly_cost_cap_usd=0.001)
    h = key_header(key["key"])

    assert client.post("/v1/ask", json={"question": "one"}, headers=h).status_code == 200
    r = client.post("/v1/ask", json={"question": "two"}, headers=h)
    assert r.status_code == 429
    assert r.json()["code"] == "cost_cap_exceeded"


def test_no_cap_means_no_ceiling(client, fake_answer, fake_redis):
    token = admin_token(client)
    key = make_key(client, token)  # no cap configured
    h = key_header(key["key"])
    for _ in range(3):
        assert client.post("/v1/ask", json={"question": "x"}, headers=h).status_code == 200


# ── usage read-back ──────────────────────────────────────────────────────────


def test_key_usage_reports_both_ledgers(client, fake_answer):
    token = admin_token(client)
    key = make_key(client, token)
    client.post("/v1/ask", json={"question": "x"}, headers=key_header(key["key"]))

    usage = client.get(f"/api-keys/{key['id']}/usage", headers=auth_header(token)).json()
    assert usage["totals"]["requests"] >= 1
    assert usage["totals"]["questions"] == 1
    assert usage["totals"]["cost_usd"] == 0.0016
    assert usage["totals"]["input_tokens"] == 1200
    assert any(e["route"] == "/v1/ask" for e in usage["endpoints"])
    assert usage["recent"][0]["route"] == "/v1/ask"


def test_v1_usage_is_self_service(client, fake_answer):
    token = admin_token(client)
    key = make_key(client, token)
    h = key_header(key["key"])
    client.post("/v1/ask", json={"question": "x"}, headers=h)

    body = client.get("/v1/usage", headers=h).json()
    assert body["totals"]["questions"] == 1
    assert body["rate_limit_per_hour"] == 120


def test_key_list_carries_rolling_activity(client, fake_answer):
    token = admin_token(client)
    key = make_key(client, token)
    client.post("/v1/ask", json={"question": "x"}, headers=key_header(key["key"]))

    listed = client.get("/api-keys", headers=auth_header(token)).json()[0]
    assert listed["requests_7d"] >= 1
    assert listed["cost_usd_7d"] == 0.0016


def test_stats_api_splits_channels_without_double_counting(client, fake_answer):
    token = admin_token(client)
    key = make_key(client, token)
    client.post("/v1/ask", json={"question": "x"}, headers=key_header(key["key"]))

    body = client.get("/stats/api", headers=auth_header(token)).json()
    assert body["totals"]["questions"] == 1
    assert body["totals"]["cost_usd"] == 0.0016
    assert body["channel_split"]["api_questions"] == 1
    assert body["channel_split"]["app_questions"] == 0
    # Cost is read from query_traces only — api_requests holds no cost column,
    # so the API section can never double-count the workspace total.
    assert body["channel_split"]["api_cost_usd"] == 0.0016
    assert body["by_key"][0]["name"] == "Integration"


def test_usage_is_tenant_scoped(client, fake_answer):
    a = admin_token(client, "Lovely", "ada@lovely.com")
    b = admin_token(client, "Rival", "bob@rival.com")
    key_a = make_key(client, a)
    client.post("/v1/ask", json={"question": "x"}, headers=key_header(key_a["key"]))

    assert client.get("/stats/api", headers=auth_header(b)).json()["totals"]["requests"] == 0
    r = client.get(f"/api-keys/{key_a['id']}/usage", headers=auth_header(b))
    assert r.status_code == 404


def test_observability_shows_the_channel(client, fake_answer):
    token = admin_token(client)
    key = make_key(client, token)
    client.post("/v1/ask", json={"question": "x"}, headers=key_header(key["key"]))

    row = client.get("/stats/traces", headers=auth_header(token)).json()["traces"][0]
    assert row["channel"] == "api"
    assert row["api_key_name"] == "Integration"


# ── retention ────────────────────────────────────────────────────────────────


def test_prune_drops_only_old_rows(client, fake_retrieval):
    from datetime import datetime, timedelta, timezone

    import app.db as app_db
    from app.models import ApiRequest
    from app.services import apiusage

    token = admin_token(client)
    key = make_key(client, token)
    client.get("/v1/me", headers=key_header(key["key"]))
    client.post("/v1/search", json={"query": "x"}, headers=key_header(key["key"]))

    session = app_db.SessionLocal()
    rows = session.query(ApiRequest).all()
    rows[0].created_at = datetime.now(timezone.utc) - timedelta(days=120)
    session.commit()

    assert apiusage.prune(session, 90) == 1
    assert session.query(ApiRequest).count() == 1
    session.close()
