from fastapi import FastAPI, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.orm import Session
import base64
import json
import logging
import sys
import time
from datetime import datetime, timezone
from typing import Any

from app.api.v1.router import router as v1_router
from app.auth.dependencies import AUTH_EXPIRED_HEADER
from app.config.settings import settings
from app.db.session import get_db

# Configure structured logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def _body_preview_from_response(status_code: int, response) -> str | None:
    """Return a short, log-safe preview of an error response body."""
    if status_code < 400:
        return None
    raw_body = getattr(response, "body", None)
    if not isinstance(raw_body, (bytes, bytearray)) or not raw_body:
        return None
    preview = raw_body.decode("utf-8", errors="replace").strip().replace("\n", " ")
    if not preview:
        return None
    max_chars = 600
    return preview if len(preview) <= max_chars else f"{preview[:max_chars]}..."


def _decode_jwt_payload_without_verification(token: str) -> dict[str, Any] | None:
    """Decode a JWT payload without signature verification for diagnostics only."""
    parts = token.split(".")
    if len(parts) != 3:
        return None
    payload_segment = parts[1]
    if not payload_segment:
        return None
    payload_segment += "=" * (-len(payload_segment) % 4)
    try:
        raw_payload = base64.urlsafe_b64decode(payload_segment.encode("ascii"))
        payload = json.loads(raw_payload.decode("utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _utc_iso_from_unix(value: Any) -> str | None:
    if value is None:
        return None
    try:
        timestamp = int(value)
    except (TypeError, ValueError):
        return None
    try:
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
    except Exception:
        return None


def _log_apple_signin_runtime_diagnostics() -> None:
    """Log non-secret Apple Sign In runtime diagnostics to debug invalid_client errors."""
    client_id = (settings.APPLE_CLIENT_ID or "").strip()
    redirect_uri = (settings.APPLE_REDIRECT_URI or "").strip()
    client_secret = (settings.APPLE_CLIENT_SECRET or "").strip()
    has_client_secret = bool(client_secret)

    logger.info(
        "Apple Sign In runtime | client_id=%s | redirect_uri=%s | client_secret_present=%s",
        client_id or "<missing>",
        redirect_uri or "<missing>",
        has_client_secret,
    )

    if not has_client_secret:
        logger.warning("Apple Sign In runtime | APPLE_CLIENT_SECRET is missing")
        return

    payload = _decode_jwt_payload_without_verification(client_secret)
    if payload is None:
        logger.warning("Apple Sign In runtime | unable to decode APPLE_CLIENT_SECRET payload for diagnostics")
        return

    iss = payload.get("iss")
    sub = payload.get("sub")
    aud = payload.get("aud")
    exp = payload.get("exp")
    exp_utc = _utc_iso_from_unix(exp)
    now_utc = datetime.now(timezone.utc)

    sub_matches_client_id = isinstance(sub, str) and bool(client_id) and sub == client_id
    aud_valid = aud == "https://appleid.apple.com"
    expired = False
    try:
        expired = int(exp) <= int(now_utc.timestamp())
    except (TypeError, ValueError):
        expired = False

    logger.info(
        (
            "Apple Sign In runtime claims | iss=%s | sub=%s | aud=%s | exp=%s | exp_utc=%s | "
            "sub_matches_client_id=%s | aud_valid=%s | expired=%s"
        ),
        iss if isinstance(iss, str) else "<missing>",
        sub if isinstance(sub, str) else "<missing>",
        aud if isinstance(aud, str) else "<missing>",
        exp if exp is not None else "<missing>",
        exp_utc or "<invalid>",
        sub_matches_client_id,
        aud_valid,
        expired,
    )

    if not client_id:
        logger.error("Apple Sign In runtime mismatch | APPLE_CLIENT_ID is missing")
    if not redirect_uri:
        logger.error("Apple Sign In runtime mismatch | APPLE_REDIRECT_URI is missing")
    if not sub_matches_client_id:
        logger.error("Apple Sign In runtime mismatch | APPLE_CLIENT_ID must exactly match APPLE_CLIENT_SECRET sub")
    if not aud_valid:
        logger.error("Apple Sign In runtime mismatch | APPLE_CLIENT_SECRET aud must be https://appleid.apple.com")
    if expired:
        logger.error("Apple Sign In runtime mismatch | APPLE_CLIENT_SECRET is expired")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown logging for the application."""
    # Startup
    logger.info("Application starting up")
    logger.info(f"Debug mode: {settings.DEBUG}")
    _log_apple_signin_runtime_diagnostics()
    yield
    # Shutdown
    logger.info("Application shutting down")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Votuna API",
    version="1.0.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def log_non_success_responses(request: Request, call_next):
    """Log 4xx/5xx responses application-wide for easier production debugging."""
    started_at = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.exception(
            "Unhandled exception on %s %s after %.2fms",
            request.method,
            request.url.path,
            elapsed_ms,
        )
        raise

    status_code = response.status_code
    if status_code >= 400:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        body_preview = _body_preview_from_response(status_code, response)
        log_parts = [
            f"{request.method} {request.url.path}",
            f"status={status_code}",
            f"elapsed_ms={elapsed_ms:.2f}",
        ]
        if request.client and request.client.host:
            log_parts.append(f"client={request.client.host}")
        if body_preview:
            log_parts.append(f"body={body_preview}")
        logger.warning("HTTP response debug: %s", " | ".join(log_parts))

    return response


@app.middleware("http")
async def clear_auth_cookie_on_unauthorized(request, call_next):
    """Clear auth cookie only when JWT/session auth has actually expired."""
    cookie_name = settings.AUTH_COOKIE_NAME
    had_auth_cookie = request.cookies.get(cookie_name) is not None
    auth_header = request.headers.get("Authorization", "")
    had_bearer_header = auth_header.lower().startswith("bearer ")

    response = await call_next(request)
    should_clear_cookie = (
        response.status_code == status.HTTP_401_UNAUTHORIZED
        and response.headers.get(AUTH_EXPIRED_HEADER) == "1"
        and (had_auth_cookie or had_bearer_header)
    )
    if should_clear_cookie:
        response.delete_cookie(
            cookie_name,
            path="/",
            httponly=True,
            secure=settings.AUTH_COOKIE_SECURE,
            samesite=settings.AUTH_COOKIE_SAMESITE,
        )
    return response


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin"],
    expose_headers=[AUTH_EXPIRED_HEADER],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Welcome to Votuna API"}


@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint with database connectivity test"""
    try:
        # Test database connectivity
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected", "version": "1.0.0"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}


# Include v1 routes
app.include_router(v1_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
