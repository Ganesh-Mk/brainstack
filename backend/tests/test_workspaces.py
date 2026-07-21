"""Multi-workspace: one email, many tenants — list, create, switch, isolate.

The cardinal rule under test: every workspace op keys off the TOKEN's
identity; a fresh token per workspace is the only way data scope changes.
"""

from tests.conftest import auth_header, signup


def test_create_and_list_workspaces(client):
    r = signup(client, "Acme", "Ada", "ada@acme.com")
    assert r.status_code == 201
    token = r.json()["access_token"]

    # A second workspace, same person.
    r = client.post(
        "/auth/workspaces", json={"name": "Side Project"}, headers=auth_header(token)
    )
    assert r.status_code == 201
    body = r.json()
    assert body["tenant"]["name"] == "Side Project"
    assert body["user"]["role"] == "admin"  # creator administers the new one
    token2 = body["access_token"]

    # Both tokens list both workspaces.
    for t in (token, token2):
        names = {
            w["tenant"]["name"]
            for w in client.get("/auth/workspaces", headers=auth_header(t)).json()
        }
        assert names == {"Acme", "Side Project"}


def test_switch_workspace_scopes_data(client):
    token = signup(client, "Acme", "Ada", "ada@acme.com").json()["access_token"]
    created = client.post(
        "/auth/workspaces", json={"name": "Beta Corp"}, headers=auth_header(token)
    ).json()
    beta_id = created["tenant"]["id"]

    # A conversation in Acme is invisible from Beta Corp.
    convo = client.post("/conversations", headers=auth_header(token)).json()
    switched = client.post(
        f"/auth/workspaces/{beta_id}/switch", headers=auth_header(token)
    )
    assert switched.status_code == 200
    beta_token = switched.json()["access_token"]
    assert switched.json()["tenant"]["id"] == beta_id

    assert client.get("/conversations", headers=auth_header(beta_token)).json() == []
    r = client.get(f"/conversations/{convo['id']}", headers=auth_header(beta_token))
    assert r.status_code == 404  # cross-tenant stays a 404, as everywhere


def test_switch_to_foreign_workspace_404s(client):
    ada = signup(client, "Acme", "Ada", "ada@acme.com").json()
    eve_token = signup(client, "EvilCo", "Eve", "eve@evil.com").json()["access_token"]
    r = client.post(
        f"/auth/workspaces/{ada['tenant']['id']}/switch",
        headers=auth_header(eve_token),
    )
    assert r.status_code == 404


def test_same_email_invited_into_second_tenant(client):
    """Per-tenant email uniqueness: Bob can be a member of two workspaces."""
    signup(client, "Acme", "Ada", "ada@acme.com")
    admin2 = signup(client, "Beta", "Bea", "bea@beta.com").json()["access_token"]

    # Bob joins Acme by signup? No — Acme's admin exists; Bob gets invited to
    # Beta while already being Acme's admin under another row.
    bob = signup(client, "Bobs", "Bob", "bob@x.com").json()
    invite = client.post(
        "/auth/invites",
        json={"email": "bob@x.com", "role": "manager"},
        headers=auth_header(admin2),
    ).json()
    r = client.post(
        f"/auth/invites/{invite['token']}/accept",
        json={"name": "Bob", "password": "password456"},
    )
    assert r.status_code == 201

    # Bob's workspace list (from his original token) shows both tenants.
    names = {
        w["tenant"]["name"]
        for w in client.get(
            "/auth/workspaces", headers=auth_header(bob["access_token"])
        ).json()
    }
    assert names == {"Bobs", "Beta"}

    # Login picks a row whose password matches — Bob's newer Beta password.
    r = client.post(
        "/auth/login", json={"email": "bob@x.com", "password": "password456"}
    )
    assert r.status_code == 200
    assert r.json()["tenant"]["name"] == "Beta"
    # ...and his original password still opens the original workspace.
    r = client.post(
        "/auth/login", json={"email": "bob@x.com", "password": "password123"}
    )
    assert r.status_code == 200
    assert r.json()["tenant"]["name"] == "Bobs"


def test_duplicate_invite_within_tenant_still_409s(client):
    admin = signup(client, "Acme", "Ada", "ada@acme.com").json()["access_token"]
    r = client.post(
        "/auth/invites",
        json={"email": "ada@acme.com", "role": "employee"},
        headers=auth_header(admin),
    )
    assert r.status_code == 409


def test_dashboard_recent_questions_shape(client):
    token = signup(client, "Acme", "Ada", "ada@acme.com").json()["access_token"]
    r = client.get("/stats/dashboard", headers=auth_header(token))
    assert r.status_code == 200
    assert r.json()["recent_questions"] == []
