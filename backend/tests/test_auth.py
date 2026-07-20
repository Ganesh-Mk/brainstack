"""The Phase 0 definition of done, as executable tests."""

from tests.conftest import auth_header, signup


def test_signup_creates_tenant_and_admin(client):
    r = signup(client, "Company A", "Ada", "ada@company-a.com")
    assert r.status_code == 201
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "admin"
    assert body["user"]["email"] == "ada@company-a.com"
    assert body["tenant"]["name"] == "Company A"
    assert body["tenant"]["slug"] == "company-a"


def test_login_and_me(client):
    signup(client, "Company A", "Ada", "ada@company-a.com")
    r = client.post(
        "/auth/login", json={"email": "ada@company-a.com", "password": "password123"}
    )
    assert r.status_code == 200
    token = r.json()["access_token"]

    me = client.get("/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json()["tenant"]["name"] == "Company A"
    assert me.json()["user"]["role"] == "admin"


def test_duplicate_email_rejected(client):
    signup(client, "Company A", "Ada", "ada@company-a.com")
    r = signup(client, "Company B", "Imposter", "ada@company-a.com")
    assert r.status_code == 409


def test_wrong_password_401(client):
    signup(client, "Company A", "Ada", "ada@company-a.com")
    r = client.post(
        "/auth/login", json={"email": "ada@company-a.com", "password": "wrong"}
    )
    assert r.status_code == 401


def test_garbage_and_missing_token_401(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers=auth_header("garbage")).status_code == 401


def test_tenant_isolation(client):
    """Two companies; each admin sees only their own tenant."""
    company_a = signup(client, "Company A", "Ada", "ada@company-a.com").json()
    company_b = signup(client, "Company B", "Gil", "gil@company-b.com").json()

    company_a_me = client.get("/auth/me", headers=auth_header(company_a["access_token"]))
    company_b_me = client.get("/auth/me", headers=auth_header(company_b["access_token"]))

    assert company_a_me.json()["tenant"]["name"] == "Company A"
    assert company_b_me.json()["tenant"]["name"] == "Company B"
    assert company_a["tenant"]["id"] != company_b["tenant"]["id"]


def test_invite_flow_end_to_end(client):
    admin = signup(client, "Company A", "Ada", "ada@company-a.com").json()

    created = client.post(
        "/auth/invites",
        headers=auth_header(admin["access_token"]),
        json={"email": "bob@company-a.com", "role": "manager"},
    )
    assert created.status_code == 201
    token = created.json()["token"]

    info = client.get(f"/auth/invites/{token}")
    assert info.status_code == 200
    assert info.json()["company_name"] == "Company A"
    assert info.json()["role"] == "manager"

    accepted = client.post(
        f"/auth/invites/{token}/accept",
        json={"name": "Bob", "password": "password123"},
    )
    assert accepted.status_code == 201
    assert accepted.json()["user"]["role"] == "manager"
    assert accepted.json()["tenant"]["name"] == "Company A"

    # Same tenant as the admin who invited.
    assert accepted.json()["tenant"]["id"] == admin["tenant"]["id"]
    # One-time: re-accepting fails.
    assert (
        client.post(
            f"/auth/invites/{token}/accept",
            json={"name": "Bob2", "password": "password123"},
        ).status_code
        == 404
    )


def test_non_admin_cannot_invite(client):
    admin = signup(client, "Company A", "Ada", "ada@company-a.com").json()
    invite = client.post(
        "/auth/invites",
        headers=auth_header(admin["access_token"]),
        json={"email": "emp@company-a.com", "role": "employee"},
    ).json()
    employee = client.post(
        f"/auth/invites/{invite['token']}/accept",
        json={"name": "Emp", "password": "password123"},
    ).json()

    r = client.post(
        "/auth/invites",
        headers=auth_header(employee["access_token"]),
        json={"email": "someone@company-a.com", "role": "employee"},
    )
    assert r.status_code == 403


def test_password_min_length_validation(client):
    r = client.post(
        "/auth/signup",
        json={
            "company_name": "Company A",
            "name": "Ada",
            "email": "ada@company-a.com",
            "password": "short",
        },
    )
    assert r.status_code == 422
