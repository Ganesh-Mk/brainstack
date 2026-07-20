"""App configuration.

Reads the repo-root `.env` (the single master env file for the whole
project). Extra keys in that file (frontend vars, model defaults for later
phases) are ignored here until a phase needs them.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_ENV, env_file_encoding="utf-8", extra="ignore"
    )

    # Database (Supabase Postgres via session pooler)
    DATABASE_URL: str

    # Auth
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    INVITE_EXPIRE_DAYS: int = 7

    # Redis (Upstash, live in dev too)
    REDIS_URL: str = ""

    # Pinecone — the vector store. One index; namespace per tenant.
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX: str = "brainstack"

    # Supabase Storage — original uploaded files (private `documents` bucket)
    SUPABASE_URL: str = ""
    SUPABASE_SECRET_KEY: str = ""
    STORAGE_BUCKET: str = "documents"

    # Chat / grounded Q&A
    ANTHROPIC_API_KEY: str = ""
    LLM_MODEL_DEV: str = "claude-haiku-4-5"  # cheap-in-dev per the guide
    CHAT_MAX_TOKENS: int = 1024
    CHAT_TOP_K: int = 6
    CHAT_HISTORY_TURNS: int = 6  # prior messages included in the prompt
    CHAT_MAX_QUESTION_CHARS: int = 4000

    # The agent (LangGraph)
    TAVILY_API_KEY: str = ""
    LLM_MODEL_AGENT: str = "claude-haiku-4-5"  # env-swap up for demos
    AGENT_MAX_STEPS: int = 4  # tool invocations per question — cost cap
    WEB_SEARCH_MAX_RESULTS: int = 4

    # Ingestion pipeline
    # fastembed runs the same all-MiniLM-L6-v2 the lab used (384-dim, matches
    # the Pinecone index) but on ONNX — no PyTorch, fits the Render free tier.
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    CHUNK_SIZE: int = 400  # lab-measured optimum (PHASE_3: 8/8 hit@1)
    CHUNK_OVERLAP: int = 80
    EMBED_BATCH_SIZE: int = 100  # also the Pinecone upsert batch size
    MAX_UPLOAD_BYTES: int = 15 * 1024 * 1024
    URL_FETCH_TIMEOUT: float = 20.0
    URL_FETCH_MAX_BYTES: int = 5 * 1024 * 1024

    # CORS — the Phase 1 product surfaces
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://brainstack.space",
        "https://www.brainstack.space",
        "https://app.brainstack.space",
    ]

    @property
    def sqlalchemy_url(self) -> str:
        """DATABASE_URL with the psycopg3 driver made explicit."""
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
