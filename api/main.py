from fastapi import FastAPI, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.orm import Session
import logging
import sys
import time

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown logging for the application."""
    # Startup
    logger.info("Application starting up")
    logger.info(f"Debug mode: {settings.DEBUG}")
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
