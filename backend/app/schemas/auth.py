import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

Role = Literal["admin", "manager", "employee"]


class SignupRequest(BaseModel):
    company_name: str = Field(min_length=2, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TenantOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str
    role: Role

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    user: UserOut
    tenant: TenantOut


class AuthResponse(MeResponse):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class InviteCreateRequest(BaseModel):
    email: EmailStr
    role: Role = "employee"


class InviteOut(BaseModel):
    token: str
    email: EmailStr
    role: Role
    expires_at: datetime


class InviteInfoResponse(BaseModel):
    company_name: str
    email: EmailStr
    role: Role


class InviteAcceptRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class MemberOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str
    role: Role
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberRoleUpdate(BaseModel):
    role: Role


class TenantUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class WorkspaceOut(BaseModel):
    tenant: TenantOut
    role: Role

    model_config = {"from_attributes": True}


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
