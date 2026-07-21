"""phase 11d: api_requests + query_traces channel attribution

Two ledgers at two grains, joined rather than duplicated (PHASE_11 §1.6):
query_traces stays the AI ledger and gains the caller's identity;
api_requests is the HTTP ledger and carries query_trace_id instead of a
second copy of the cost.

Existing query_traces rows are app-channel by definition, which is exactly
what the server_defaults below backfill.

Revision ID: c8f3a52be104
Revises: b4e1c7a90d31
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c8f3a52be104"
down_revision: Union[str, Sequence[str], None] = "b4e1c7a90d31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "query_traces",
        sa.Column(
            "channel", sa.String(length=8), nullable=False, server_default="app"
        ),
    )
    op.add_column(
        "query_traces",
        sa.Column(
            "environment", sa.String(length=8), nullable=False, server_default="app"
        ),
    )
    op.add_column(
        "query_traces", sa.Column("api_key_id", sa.Uuid(), nullable=True)
    )
    op.create_index(
        op.f("ix_query_traces_api_key_id"), "query_traces", ["api_key_id"]
    )

    op.create_table(
        "api_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("api_key_id", sa.Uuid(), nullable=True),
        sa.Column("request_id", sa.String(length=36), nullable=False),
        sa.Column("method", sa.String(length=8), nullable=False),
        sa.Column("route", sa.String(length=80), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("error_code", sa.String(length=40), nullable=True),
        sa.Column("query_trace_id", sa.Uuid(), nullable=True),
        sa.Column("environment", sa.String(length=8), nullable=False),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # No FK to api_keys or tenants on purpose: a rejected call has no key, and
    # the audit trail of a deleted workspace should outlive the workspace.
    op.create_index(op.f("ix_api_requests_tenant_id"), "api_requests", ["tenant_id"])
    op.create_index(op.f("ix_api_requests_api_key_id"), "api_requests", ["api_key_id"])
    op.create_index(op.f("ix_api_requests_request_id"), "api_requests", ["request_id"])
    op.create_index(op.f("ix_api_requests_route"), "api_requests", ["route"])
    op.create_index(op.f("ix_api_requests_created_at"), "api_requests", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_api_requests_created_at"), table_name="api_requests")
    op.drop_index(op.f("ix_api_requests_route"), table_name="api_requests")
    op.drop_index(op.f("ix_api_requests_request_id"), table_name="api_requests")
    op.drop_index(op.f("ix_api_requests_api_key_id"), table_name="api_requests")
    op.drop_index(op.f("ix_api_requests_tenant_id"), table_name="api_requests")
    op.drop_table("api_requests")
    op.drop_index(op.f("ix_query_traces_api_key_id"), table_name="query_traces")
    op.drop_column("query_traces", "api_key_id")
    op.drop_column("query_traces", "environment")
    op.drop_column("query_traces", "channel")
