import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.core.metering import MeteringMiddleware
from app.core.principal import ApiError
from app.routers import (
    apikeys,
    auth,
    company,
    conversations,
    documents,
    health,
    memories,
    stats,
    v1,
)

app = FastAPI(
    title="BrainStack API",
    description="Backend Phase 0 — multi-tenant foundation (no AI yet).",
    version="0.1.0",
)

if get_settings().API_V1_ENABLED:
    # Added before CORS so CORS ends up outermost (Starlette applies
    # middleware in reverse). Only acts on /v1 paths.
    app.add_middleware(MeteringMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    """One error shape for `/v1` (PHASE_11 §4), so client code can branch on a
    stable `code` rather than on prose. The request id is echoed in the body
    and the header — when a customer reports "call 8f2c failed", that is the
    lookup key."""
    request_id = getattr(request.state, "request_id", None) or str(uuid.uuid4())
    # The metering middleware reads this when it writes the api_requests row —
    # refusals are exactly the rows you need when a key leaks.
    request.state.error_code = exc.code
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
            "request_id": request_id,
            **exc.extra,
        },
        headers={"X-Request-Id": request_id, **exc.response_headers},
    )


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(conversations.router)
app.include_router(company.router)
app.include_router(memories.router)
app.include_router(stats.router)
app.include_router(apikeys.router)

if get_settings().API_V1_ENABLED:
    app.include_router(v1.router)
