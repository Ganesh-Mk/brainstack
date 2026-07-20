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

from app.db import Base, get_db
from app.main import app


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
