"""Auth routes"""

import logging
from datetime import datetime, timezone
from typing import Any, Mapping, cast
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.auth.jwt import create_access_token
from app.auth.sso import (
    AuthProvider,
    OpenIDUserProtocol,
    SSOProtocol,
    get_openid_value,
    get_provider_config,
    get_sso,
)
from app.config.settings import settings
from app.crud.user import user_crud
from app.crud.user_settings import user_settings_crud
from app.db.session import get_db
from app.services.music_providers import ProviderAPIError, ProviderAuthError, get_music_provider
from app.services.votuna_invites import join_invite_by_token
from app.utils.avatar_storage import (
    delete_avatar_if_exists,
    get_avatar_file_path,
    save_avatar_from_url,
)
from app.utils.token_expiry import coerce_expires_at, expires_at_from_payload

router = APIRouter()
logger = logging.getLogger(__name__)

PENDING_INVITE_COOKIE = "votuna_pending_invite_token"
PENDING_NEXT_COOKIE = "votuna_pending_next"
PENDING_CONTEXT_MAX_AGE = 600


def _is_safe_next_path(next_path: str | None) -> bool:
    if not next_path:
        return False
    return next_path.startswith("/") and not next_path.startswith("//")


def _local_avatar_exists(avatar_url: str | None) -> bool:
    """Return whether a locally stored avatar file exists."""
    if not avatar_url or str(avatar_url).startswith("http"):
        return False
    try:
        return get_avatar_file_path(str(avatar_url)).exists()
    except HTTPException:
        return False


def _extract_sso_expires_at(sso: SSOProtocol) -> datetime | None:
    expires_at = coerce_expires_at(getattr(sso, "expires_at", None))
    if expires_at is not None:
        return expires_at

    oauth_client = getattr(sso, "_oauth_client", None)
    token_payload = getattr(oauth_client, "token", None)
    if isinstance(token_payload, Mapping):
        expires_at = expires_at_from_payload(token_payload)
        if expires_at is not None:
            return expires_at

    return coerce_expires_at(getattr(oauth_client, "expires_at", None))


async def _fetch_soundcloud_permalink_url(
    access_token: str | None,
    provider_user_id: str,
) -> str | None:
    token = (access_token or "").strip()
    user_id = provider_user_id.strip()
    if not token or not user_id:
        return None
    # SoundCloud user IDs are numeric; skip lookups for non-numeric ids to avoid bad requests.
    if not user_id.isdigit():
        return None
    try:
        provider = get_music_provider("soundcloud", token)
        provider_user = await provider.get_user(user_id)
    except (ProviderAuthError, ProviderAPIError):
        return None
    except Exception:
        logger.exception("Failed to fetch SoundCloud permalink_url for user %s", user_id)
        return None
    return provider_user.profile_url


@router.get("/login/{provider}")
async def login_provider(
    provider: AuthProvider,
    invite_token: str | None = Query(default=None),
    next_path: str | None = Query(default=None, alias="next"),
) -> Response:
    """Redirect the user to the provider's OAuth login flow."""
    try:
        sso: SSOProtocol = get_sso(provider)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    response = await sso.get_login_redirect()
    if invite_token:
        response.set_cookie(
            PENDING_INVITE_COOKIE,
            invite_token,
            httponly=True,
            secure=settings.AUTH_COOKIE_SECURE,
            samesite=settings.AUTH_COOKIE_SAMESITE,
            max_age=PENDING_CONTEXT_MAX_AGE,
        )
    else:
        response.delete_cookie(PENDING_INVITE_COOKIE)

    if _is_safe_next_path(next_path):
        response.set_cookie(
            PENDING_NEXT_COOKIE,
            next_path,
            httponly=True,
            secure=settings.AUTH_COOKIE_SECURE,
            samesite=settings.AUTH_COOKIE_SAMESITE,
            max_age=PENDING_CONTEXT_MAX_AGE,
        )
    else:
        response.delete_cookie(PENDING_NEXT_COOKIE)
    return response


@router.get("/callback/{provider}")
async def callback_provider(
    provider: AuthProvider,
    request: Request,
    db: Session = Depends(get_db),
) -> Response:
    """Handle the OAuth callback, issue a session token, and redirect."""
    try:
        sso: SSOProtocol = get_sso(provider)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    provider_config = get_provider_config(provider)
    try:
        async with sso:
            openid: OpenIDUserProtocol = await sso.verify_and_process(request)
            access_token = getattr(sso, "access_token", None)
            refresh_token = getattr(sso, "refresh_token", None)
            expires_at = _extract_sso_expires_at(sso)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    provider_user_id = get_openid_value(openid, *provider_config.id_keys)
    if not provider_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing {provider.value} user id",
        )

    email = get_openid_value(openid, *provider_config.email_keys)
    first_name = get_openid_value(openid, "first_name")
    last_name = get_openid_value(openid, "last_name")
    display_name = get_openid_value(openid, *provider_config.display_name_keys)
    provider_avatar_url = get_openid_value(openid, *provider_config.avatar_keys)

    provider_user_id_str = str(provider_user_id)
    provider_permalink_url = None
    if provider is AuthProvider.soundcloud:
        provider_permalink_url = await _fetch_soundcloud_permalink_url(access_token, provider_user_id_str)
    user = user_crud.get_by_provider_id(db, provider.value, provider_user_id_str)
    if not user:
        user = user_crud.create(
            db,
            {
                "auth_provider": provider.value,
                "provider_user_id": provider_user_id_str,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "display_name": display_name,
                "avatar_url": None,
                "permalink_url": provider_permalink_url,
                "last_login_at": datetime.now(timezone.utc),
            },
        )
        if provider_avatar_url:
            stored_avatar = await save_avatar_from_url(str(provider_avatar_url), user.id)
            if stored_avatar:
                user = user_crud.update(db, user, {"avatar_url": stored_avatar})
            else:
                user = user_crud.update(db, user, {"avatar_url": str(provider_avatar_url)})
    else:
        user = user_crud.update(
            db,
            user,
            {
                "email": email or user.email,
                "first_name": first_name or user.first_name,
                "last_name": last_name or user.last_name,
                "display_name": display_name or user.display_name,
                "permalink_url": provider_permalink_url or user.permalink_url,
                "last_login_at": datetime.now(timezone.utc),
            },
        )
        avatar_needs_refresh = (
            not user.avatar_url or str(user.avatar_url).startswith("http") or not _local_avatar_exists(user.avatar_url)
        )
        if provider_avatar_url and avatar_needs_refresh:
            previous_avatar = user.avatar_url
            stored_avatar = await save_avatar_from_url(str(provider_avatar_url), user.id)
            if stored_avatar:
                if previous_avatar and not str(previous_avatar).startswith("http") and previous_avatar != stored_avatar:
                    delete_avatar_if_exists(str(previous_avatar))
                user = user_crud.update(db, user, {"avatar_url": stored_avatar})
            elif not previous_avatar or not _local_avatar_exists(str(previous_avatar)):
                user = user_crud.update(db, user, {"avatar_url": str(provider_avatar_url)})
        elif (
            user.avatar_url
            and not str(user.avatar_url).startswith("http")
            and not _local_avatar_exists(user.avatar_url)
        ):
            user = user_crud.update(db, user, {"avatar_url": None})

    if access_token or refresh_token or expires_at:
        updates: dict[str, Any] = {
            "token_expires_at": expires_at,
        }
        if access_token:
            updates["access_token"] = access_token
        if refresh_token:
            updates["refresh_token"] = refresh_token
        user_crud.update(
            db,
            user,
            updates,
        )

    user_id = cast(int, user.id)
    if not user_settings_crud.get_by_user_id(db, user_id):
        user_settings_crud.create(db, {"user_id": user_id})

    jwt_token = create_access_token(str(user.id))

    pending_invite_token = request.cookies.get(PENDING_INVITE_COOKIE)
    pending_next = request.cookies.get(PENDING_NEXT_COOKIE)

    invite_joined_playlist_id: int | None = None
    invite_error: str | None = None

    if pending_invite_token:
        try:
            joined_playlist = join_invite_by_token(db, pending_invite_token, user)
            invite_joined_playlist_id = joined_playlist.id
        except HTTPException as exc:
            invite_error = str(exc.detail)

    if invite_error:
        redirect_target = f"{settings.FRONTEND_URL.rstrip('/')}/?invite_error={quote(invite_error)}"
    elif invite_joined_playlist_id is not None:
        redirect_target = f"{settings.FRONTEND_URL.rstrip('/')}/playlists/{invite_joined_playlist_id}"
    elif _is_safe_next_path(pending_next):
        redirect_target = f"{settings.FRONTEND_URL.rstrip('/')}{pending_next}"
    else:
        redirect_target = settings.FRONTEND_URL

    redirect_response = RedirectResponse(url=redirect_target, status_code=status.HTTP_302_FOUND)
    redirect_response.set_cookie(
        settings.AUTH_COOKIE_NAME,
        jwt_token,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        max_age=settings.AUTH_TOKEN_EXPIRE_MINUTES * 60,
    )
    redirect_response.delete_cookie(PENDING_INVITE_COOKIE)
    redirect_response.delete_cookie(PENDING_NEXT_COOKIE)
    return redirect_response


@router.post("/logout")
async def logout():
    """Clear the auth cookie for the current session."""
    response = JSONResponse({"status": "logged_out"})
    response.delete_cookie(
        settings.AUTH_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    return response
