"""The Phase 0 definition of done, as executable tests."""

from tests.conftest import auth_header, signup


def test_signup_creates_tenant_and_admin(client):
    r = signup(client, "Acme Corp", "Ada", "ada@acme.example")
    assert r.status_code == 201
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "admin"
    assert body["user"]["email"] == "ada@acme.example"
    assert body["tenant"]["name"] == "Acme Corp"
    assert body["tenant"]["slug"] == "acme-corp"


def test_login_and_me(client):
    signup(client, "Acme Corp", "Ada", "ada@acme.example")
    r = client.post(
        "/auth/login", json={"email": "ada@acme.example", "password": "password123"}
    )
    assert r.status_code == 200
    token = r.json()["access_token"]

    me = client.get("/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json()["tenant"]["name"] == "Acme Corp"
    assert me.json()["user"]["role"] == "admin"


def test_duplicate_email_rejected(client):
    signup(client, "Acme Corp", "Ada", "ada@acme.example")
    r = signup(client, "Another Co", "Imposter", "ada@acme.example")
    assert r.status_code == 409


def test_wrong_password_401(client):
    signup(client, "Acme Corp", "Ada", "ada@acme.example")
    r = client.post(
        "/auth/login", json={"email": "ada@acme.example", "password": "wrong"}
    )
    assert r.status_code == 401


def test_garbage_and_missing_token_401(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers=auth_header("garbage")).status_code == 401


def test_tenant_isolation(client):
    """Two companies; each admin sees only their own tenant."""
    acme = signup(client, "Acme Corp", "Ada", "ada@acme.example").json()
    globex = signup(client, "Globex Ltd", "Gil", "gil@globex.example").json()

    acme_me = client.get("/auth/me", headers=auth_header(acme["access_token"]))
    globex_me = client.get("/auth/me", headers=auth_header(globex["access_token"]))

    assert acme_me.json()["tenant"]["name"] == "Acme Corp"
    assert globex_me.json()["tenant"]["name"] == "Globex Ltd"
    assert acme["tenant"]["id"] != globex["tenant"]["id"]


def test_invite_flow_end_to_end(client):
    admin = signup(client, "Acme Corp", "Ada", "ada@acme.example").json()

    created = client.post(
        "/auth/invites",
        headers=auth_header(admin["access_token"]),
        json={"email": "bob@acme.example", "role": "manager"},
    )
    assert created.status_code == 201
    token = created.json()["token"]

    info = client.get(f"/auth/invites/{token}")
    assert info.status_code == 200
    assert info.json()["company_name"] == "Acme Corp"
    assert info.json()["role"] == "manager"

    accepted = client.post(
        f"/auth/invites/{token}/accept",
        json={"name": "Bob", "password": "password123"},
    )
    assert accepted.status_code == 201
    assert accepted.json()["user"]["role"] == "manager"
    assert accepted.json()["tenant"]["name"] == "Acme Corp"

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
    admin = signup(client, "Acme Corp", "Ada", "ada@acme.example").json()
    invite = client.post(
        "/auth/invites",
        headers=auth_header(admin["access_token"]),
        json={"email": "emp@acme.example", "role": "employee"},
    ).json()
    employee = client.post(
        f"/auth/invites/{invite['token']}/accept",
        json={"name": "Emp", "password": "password123"},
    ).json()

    r = client.post(
        "/auth/invites",
        headers=auth_header(employee["access_token"]),
        json={"email": "someone@acme.example", "role": "employee"},
    )
    assert r.status_code == 403


def test_password_min_length_validation(client):
    r = client.post(
        "/auth/signup",
        json={
            "company_name": "Acme",
            "name": "Ada",
            "email": "ada@acme.example",
            "password": "short",
        },
    )
    assert r.status_code == 422
