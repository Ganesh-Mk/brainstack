"""Long-term memory management (Phase 8) — the /agent/memory page's API.

Memories are scoped tenant AND user (like conversations): you see and delete
only your own. Deleting removes the Pinecone vector too.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, get_current_user
from app.db import get_db
from app.models import Memory
from app.schemas.memory import MemoryOut
from app.services import memory as memory_service

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("", response_model=list[MemoryOut])
def list_memories(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MemoryOut]:
    rows = db.scalars(
        select(Memory)
        .where(Memory.tenant_id == current.tenant_id, Memory.user_id == current.user.id)
        .order_by(Memory.created_at.desc(), Memory.id.desc())
    )
    return [MemoryOut.model_validate(r) for r in rows]


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memory(
    memory_id: uuid.UUID,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    row = db.get(Memory, memory_id)
    if (
        row is None
        or row.tenant_id != current.tenant_id
        or row.user_id != current.user.id
    ):
        raise HTTPException(status_code=404, detail="Memory not found")
    memory_service.delete_memory(db, row)
