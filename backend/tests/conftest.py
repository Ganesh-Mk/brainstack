"""Test fixtures — a throwaway SQLite database per test module.

We test the app logic (auth, tenancy, RBAC) against SQLite so the suite is
fast and hermetic; the same SQLAlchemy models run on Supabase Postgres in
production. Uuid/DateTime types are dialect-portable in SQLAlchemy 2.0.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.db import Base, get_db
from app.main import app
from app.services import mcp_client, memory, rerank, vectorstore


@pytest.fixture(autouse=True)
def no_mcp_by_default(monkeypatch):
    """Tests never talk to a live Company MCP service: unconfigure it and
    clear the discovery cache. Tests that WANT it set these attrs + mocks."""
    settings = get_settings()
    monkeypatch.setattr(settings, "COMPANY_MCP_URL", "")
    monkeypatch.setattr(settings, "MCP_SHARED_SECRET", "")
    mcp_client.reset_cache()
    yield
    mcp_client.reset_cache()


def _no_llm(*args, **kwargs):
    raise RuntimeError("no LLM calls in unit tests")


@pytest.fixture(autouse=True)
def sealed_seams(monkeypatch):
    """The suite must be hermetic: .env holds REAL keys, so the Phase 8 paths
    (memory extraction/recall, summarization, reflection critic, reranker)
    would otherwise hit live Anthropic/Pinecone from tests. Seal every seam;
    the graceful-degradation design turns each into a clean no-op. Tests that
    exercise a seam re-patch it themselves."""
    monkeypatch.setattr(memory, "haiku", _no_llm)  # extract/summary/critic → no-op
    monkeypatch.setattr(vectorstore, "get_index", _no_llm)  # recall → []
    monkeypatch.setattr(rerank, "get_model", lambda: None)  # keep retrieval order


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    # Background tasks (the ingestion pipeline) open their own session via
    # app.db.SessionLocal — point it at the test engine so they never touch
    # the real database, then restore it afterwards.
    import app.db as app_db

    real_session_local = app_db.SessionLocal
    app_db.SessionLocal = TestingSession
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app_db.SessionLocal = real_session_local
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)


def signup(client, company, name, email, password="password123"):
    return client.post(
        "/auth/signup",
        json={
            "company_name": company,
            "name": name,
            "email": email,
            "password": password,
        },
    )


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
