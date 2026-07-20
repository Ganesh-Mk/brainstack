"""Request dependencies.

🔑 THE rule of this codebase (PROJECT_GUIDE.md §Phase 0): get_current_user()
is the ONLY source of (user, tenant_id, role). Every endpoint that touches
tenant data takes them from here — never from a request body or query param.
tenant_id later becomes the Pinecone namespace.
"""

import uuid
from dataclasses import dataclass

import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db import get_db
from app.models import User

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    user: User
    tenant_id: uuid.UUID
    role: str


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> CurrentUser:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        payload = decode_access_token(credentials.credentials)
    except pyjwt.PyJWTError:
        raise unauthorized

    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None:
        raise unauthorized

    # tenant_id/role come from the DB row, not the token claims — a stale
    # token can't outlive a role change or tenant move.
    return CurrentUser(user=user, tenant_id=user.tenant_id, role=user.role)


def require_admin(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if current.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required"
        )
    return current
