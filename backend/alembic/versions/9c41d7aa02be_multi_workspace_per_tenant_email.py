"""multi-workspace: email unique per tenant, not globally

The same person (email) can now hold a user row in several tenants —
one per workspace. Uniqueness moves from users.email to (tenant_id, email).

Revision ID: 9c41d7aa02be
Revises: 338e045b9114
Create Date: 2026-07-21
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9c41d7aa02be"
down_revision: Union[str, Sequence[str], None] = "338e045b9114"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)
    op.create_unique_constraint(
        "uq_users_tenant_email", "users", ["tenant_id", "email"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_tenant_email", "users", type_="unique")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
