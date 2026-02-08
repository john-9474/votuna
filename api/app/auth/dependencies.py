"""Auth dependencies"""
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.jwt import decode_access_token
from app.config.settings import settings
from app.crud.user import user_crud
from app.db.session import get_db

AUTH_EXPIRED_HEADER = "X-Votuna-Auth-Expired"


def _get_token_from_request(request: Request) -> str | None:
    """Extract a bearer token from headers or the auth cookie."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()

    cookie_name = settings.AUTH_COOKIE_NAME
    return request.cookies.get(cookie_name)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
):
    """Resolve the authenticated user from the request token."""
    token = _get_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={AUTH_EXPIRED_HEADER: "1"},
        )

    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={AUTH_EXPIRED_HEADER: "1"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={AUTH_EXPIRED_HEADER: "1"},
        )

    user = user_crud.get(db, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
            headers={AUTH_EXPIRED_HEADER: "1"},
        )
    return user


def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db),
):
    """Resolve authenticated user or return None when unauthenticated."""
    try:
        return get_current_user(request, db)
    except HTTPException:
        return None
