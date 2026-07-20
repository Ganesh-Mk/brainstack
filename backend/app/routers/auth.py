import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import CurrentUser, get_current_user, require_admin
from app.core.security import create_access_token, hash_password, verify_password
from app.db import get_db
from app.models import Invite, Tenant, User
from app.schemas.auth import (
    AuthResponse,
    InviteAcceptRequest,
    InviteCreateRequest,
    InviteInfoResponse,
    InviteOut,
    LoginRequest,
    MemberOut,
    MemberRoleUpdate,
    MeResponse,
    SignupRequest,
    TenantOut,
    TenantUpdateRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _slugify(name: str, db: Session) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "company"
    slug = base
    n = 2
    while db.scalar(select(Tenant.id).where(Tenant.slug == slug)) is not None:
        slug = f"{base}-{n}"
        n += 1
    return slug


def _auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id, user.tenant_id, user.role),
        user=user,
        tenant=user.tenant,
    )


@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(body: SignupRequest, db: Session = Depends(get_db)) -> AuthResponse:
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    tenant = Tenant(name=body.company_name, slug=_slugify(body.company_name, db))
    db.add(tenant)
    db.flush()
    user = User(
        tenant_id=tenant.id,
        email=email,
        name=body.name,
        password_hash=hash_password(body.password),
        role="admin",  # first user of a tenant is its admin
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    # Same error for unknown email and wrong password — no account probing.
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return _auth_response(user)


@router.get("/me", response_model=MeResponse)
def me(current: CurrentUser = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user=current.user, tenant=current.user.tenant)


@router.post("/invites", response_model=InviteOut, status_code=201)
def create_invite(
    body: InviteCreateRequest,
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> InviteOut:
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )
    invite = Invite(
        tenant_id=current.tenant_id,
        email=email,
        role=body.role,
        token=secrets.token_urlsafe(32),
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=get_settings().INVITE_EXPIRE_DAYS),
    )
    db.add(invite)
    db.commit()
    return InviteOut(
        token=invite.token,
        email=invite.email,
        role=invite.role,
        expires_at=invite.expires_at,
    )


def _valid_invite(token: str, db: Session) -> Invite:
    invite = db.scalar(select(Invite).where(Invite.token == token))
    expired = invite is not None and invite.expires_at.replace(
        tzinfo=timezone.utc
    ) < datetime.now(timezone.utc)
    if invite is None or invite.accepted_at is not None or expired:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found, expired, or already used",
        )
    return invite


@router.get("/invites/{token}", response_model=InviteInfoResponse)
def invite_info(token: str, db: Session = Depends(get_db)) -> InviteInfoResponse:
    invite = _valid_invite(token, db)
    return InviteInfoResponse(
        company_name=invite.tenant.name, email=invite.email, role=invite.role
    )


@router.post("/invites/{token}/accept", response_model=AuthResponse, status_code=201)
def accept_invite(
    token: str, body: InviteAcceptRequest, db: Session = Depends(get_db)
) -> AuthResponse:
    invite = _valid_invite(token, db)
    if db.scalar(select(User.id).where(User.email == invite.email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )
    user = User(
        tenant_id=invite.tenant_id,
        email=invite.email,
        name=body.name,
        password_hash=hash_password(body.password),
        role=invite.role,
    )
    invite.accepted_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _auth_response(user)


# ── Members & workspace (Phase 10) ──────────────────────────────────────────


@router.get("/members", response_model=list[MemberOut])
def list_members(
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .where(User.tenant_id == current.tenant_id)
            .order_by(User.created_at.asc())
        )
    )


def _member_or_404(member_id: uuid.UUID, current: CurrentUser, db: Session) -> User:
    user = db.get(User, member_id)
    if user is None or user.tenant_id != current.tenant_id:
        raise HTTPException(status_code=404, detail="Member not found")
    return user


@router.patch("/members/{member_id}", response_model=MemberOut)
def update_member_role(
    member_id: uuid.UUID,
    body: MemberRoleUpdate,
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    user = _member_or_404(member_id, current, db)
    if user.id == current.user.id:
        raise HTTPException(
            status_code=400,
            detail="You can't change your own role — ask another admin.",
        )
    user.role = body.role
    db.commit()
    db.refresh(user)
    return user


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    member_id: uuid.UUID,
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    user = _member_or_404(member_id, current, db)
    if user.id == current.user.id:
        raise HTTPException(
            status_code=400, detail="You can't remove yourself from the workspace."
        )
    db.delete(user)
    db.commit()


@router.patch("/tenant", response_model=TenantOut)
def rename_workspace(
    body: TenantUpdateRequest,
    current: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    tenant = current.user.tenant
    tenant.name = body.name.strip()
    db.commit()
    db.refresh(tenant)
    return tenant
