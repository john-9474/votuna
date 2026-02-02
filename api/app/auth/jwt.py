"""JWT helpers"""
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.config.settings import settings

ALGORITHM = "HS256"


def _require_secret() -> str:
    """Return the JWT secret key or raise if missing."""
    if not settings.AUTH_SECRET_KEY:
        raise ValueError("AUTH_SECRET_KEY must be set")
    return settings.AUTH_SECRET_KEY


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    """Create a signed JWT for the given subject."""
    secret = _require_secret()
    expire_minutes = expires_minutes or settings.AUTH_TOKEN_EXPIRE_MINUTES
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=expire_minutes),
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT, returning its payload."""
    secret = _require_secret()
    return jwt.decode(token, secret, algorithms=[ALGORITHM])
