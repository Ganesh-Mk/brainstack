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

    # Pinecone (used by scripts/pinecone_smoke.py; product AI comes later)
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX: str = "brainstack"

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
