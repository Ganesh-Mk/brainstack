"""phase 11a: api_keys + api_key_events

The workspace's programmatic credential, and the append-only audit of
everything that ever happens to it. Only sha256(key) is stored — the
plaintext exists once, in the create response (PHASE_11 §1.3).

Revision ID: b4e1c7a90d31
Revises: 9c41d7aa02be
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b4e1c7a90d31"
down_revision: Union[str, Sequence[str], None] = "9c41d7aa02be"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "api_keys",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("environment", sa.String(length=8), nullable=False),
        sa.Column("prefix", sa.String(length=16), nullable=False),
        sa.Column("last4", sa.String(length=4), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("scopes", sa.String(length=255), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("rate_limit_per_hour", sa.Integer(), nullable=False),
        sa.Column("monthly_cost_cap_usd", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_api_keys_tenant_id"), "api_keys", ["tenant_id"])
    op.create_index(
        op.f("ix_api_keys_created_by_user_id"), "api_keys", ["created_by_user_id"]
    )
    # Unique globally, not per tenant: the hash IS the lookup key on every
    # /v1 call, resolved before any tenant is known.
    op.create_index(op.f("ix_api_keys_key_hash"), "api_keys", ["key_hash"], unique=True)

    op.create_table(
        "api_key_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("api_key_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=24), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["api_key_id"], ["api_keys.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_api_key_events_tenant_id"), "api_key_events", ["tenant_id"]
    )
    op.create_index(
        op.f("ix_api_key_events_api_key_id"), "api_key_events", ["api_key_id"]
    )
    op.create_index(
        op.f("ix_api_key_events_created_at"), "api_key_events", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_api_key_events_created_at"), table_name="api_key_events")
    op.drop_index(op.f("ix_api_key_events_api_key_id"), table_name="api_key_events")
    op.drop_index(op.f("ix_api_key_events_tenant_id"), table_name="api_key_events")
    op.drop_table("api_key_events")
    op.drop_index(op.f("ix_api_keys_key_hash"), table_name="api_keys")
    op.drop_index(op.f("ix_api_keys_created_by_user_id"), table_name="api_keys")
    op.drop_index(op.f("ix_api_keys_tenant_id"), table_name="api_keys")
    op.drop_table("api_keys")
