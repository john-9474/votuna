from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.orm import Session
import logging
import sys

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
async def clear_auth_cookie_on_unauthorized(request, call_next):
    """Clear auth cookie only when JWT/session auth has actually expired."""
    response = await call_next(request)
    should_clear_cookie = (
        response.status_code == status.HTTP_401_UNAUTHORIZED and response.headers.get(AUTH_EXPIRED_HEADER) == "1"
    )
    if should_clear_cookie:
        response.delete_cookie(
            settings.AUTH_COOKIE_NAME,
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
