"""`GET /models` — which answering models this deployment can offer.

Feeds the Ask page's model picker. Authenticated (it reveals how the server is
configured) but not role-gated: choosing a model only affects the answer the
chooser gets back.

Deliberately uncached. `local` availability is whatever Ollama is doing right
now, and a stale green dot is worse than no dot — the probe is a 2s-timeout
HTTP call to a loopback address, which costs nothing worth caching.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, get_current_user
from app.schemas.chat import ProviderOut
from app.services import providers

router = APIRouter(tags=["models"])


@router.get("/models", response_model=list[ProviderOut])
def list_models(current: CurrentUser = Depends(get_current_user)):
    return providers.describe()
