from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Any, Literal
import os
import json


class Settings(BaseSettings):
    PROJECT_NAME: str = "Votuna API"
    DEBUG: bool = False
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8080"]

    # Database
    DATABASE_URL: str
    SQLALCHEMY_ECHO: bool = False

    # Auth (SSO + JWT)
    SPOTIFY_CLIENT_ID: str = ""
    SPOTIFY_CLIENT_SECRET: str = ""
    SPOTIFY_REDIRECT_URI: str = ""
    SOUNDCLOUD_CLIENT_ID: str = ""
    SOUNDCLOUD_CLIENT_SECRET: str = ""
    SOUNDCLOUD_REDIRECT_URI: str = ""
    SOUNDCLOUD_API_BASE_URL: str = "https://api.soundcloud.com"
    AUTH_SECRET_KEY: str = ""
    AUTH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    AUTH_COOKIE_NAME: str = "votuna_access_token"
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    FRONTEND_URL: str = "http://localhost:3000"
    USER_FILES_DIR: str = "user_files"
    MAX_AVATAR_BYTES: int = 5 * 1024 * 1024

    class Config:
        # Look for .env in repo root for local development
        env_file = os.path.join(os.path.dirname(__file__), "../../../.env")
        case_sensitive = True

    @field_validator('ALLOWED_ORIGINS', mode='before')
    @classmethod
    def parse_allowed_origins(cls, v: Any) -> List[str]:
        """Parse allowed origins from JSON or a comma-delimited string."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                # If not valid JSON, try splitting by comma
                return [origin.strip() for origin in v.split(',')]
        return v

    @field_validator('DATABASE_URL')
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Validate that the database URL is present and uses PostgreSQL."""
        if not v:
            raise ValueError("DATABASE_URL must be set")
        if not v.startswith(('postgresql://', 'postgresql+psycopg2://', 'postgresql+asyncpg://')):
            raise ValueError("DATABASE_URL must be a valid PostgreSQL URL")
        return v

    @field_validator('AUTH_COOKIE_SAMESITE', mode='before')
    @classmethod
    def validate_cookie_samesite(cls, v: Any) -> Literal["lax", "strict", "none"]:
        """Normalize and validate the cookie samesite setting."""
        if isinstance(v, str):
            normalized = v.lower()
            if normalized in {"lax", "strict", "none"}:
                return normalized  # type: ignore[return-value]
        raise ValueError("AUTH_COOKIE_SAMESITE must be one of: lax, strict, none")


settings = Settings()
