"""Provider session helpers for user-scoped API clients."""

from __future__ import annotations

import base64
import inspect
import logging
from datetime import datetime, timedelta, timezone
from typing import cast

import httpx
from sqlalchemy.orm import Session, object_session

from app.config.settings import settings
from app.crud.user import user_crud
from app.models.user import User
from app.services.music_providers.base import MusicProviderClient, ProviderAuthError
from app.services.music_providers.factory import get_music_provider
from app.utils.token_expiry import coerce_expires_at, expires_at_from_payload

logger = logging.getLogger(__name__)

TOKEN_REFRESH_TIMEOUT_SECONDS = 15
TOKEN_EXPIRY_SKEW_SECONDS = 60


def _is_expired(token_expires_at: datetime | None) -> bool:
    if not token_expires_at:
        return False
    expires_at = coerce_expires_at(token_expires_at)
    if not expires_at:
        return False
    now = datetime.now(timezone.utc) + timedelta(seconds=TOKEN_EXPIRY_SKEW_SECONDS)
    return expires_at <= now


def _persist_refreshed_tokens(
    *,
    user: User,
    access_token: str,
    refresh_token: str,
    token_expires_at: datetime | None,
    db: Session | None = None,
) -> None:
    updates = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_expires_at": token_expires_at,
    }
    db_session = db if db is not None else object_session(user)
    if db_session:
        user_crud.update(db_session, user, updates)
    else:
        user.access_token = access_token
        user.refresh_token = refresh_token
        user.token_expires_at = token_expires_at


async def refresh_soundcloud_access_token(user: User, db: Session | None = None) -> str | None:
    """Refresh the SoundCloud access token for a user when possible."""
    refresh_token = (user.refresh_token or "").strip()
    if not refresh_token:
        return None
    if not settings.SOUNDCLOUD_CLIENT_ID or not settings.SOUNDCLOUD_CLIENT_SECRET:
        logger.warning("Skipping SoundCloud token refresh because client credentials are missing")
        return None

    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": settings.SOUNDCLOUD_CLIENT_ID,
        "client_secret": settings.SOUNDCLOUD_CLIENT_SECRET,
    }
    try:
        async with httpx.AsyncClient(timeout=TOKEN_REFRESH_TIMEOUT_SECONDS) as client:
            response = await client.post(
                settings.SOUNDCLOUD_TOKEN_URL,
                data=payload,
                headers={"Accept": "application/json"},
            )
    except Exception:
        logger.exception("SoundCloud token refresh request failed")
        return None

    if not response.is_success:
        logger.warning(
            "SoundCloud token refresh failed with status %s",
            response.status_code,
        )
        return None

    try:
        token_payload = response.json() if response.content else {}
    except ValueError:
        logger.warning("SoundCloud token refresh returned invalid JSON")
        return None
    if not isinstance(token_payload, dict):
        logger.warning("SoundCloud token refresh returned non-JSON payload")
        return None

    next_access_token_raw = token_payload.get("access_token")
    if not isinstance(next_access_token_raw, str) or not next_access_token_raw.strip():
        logger.warning("SoundCloud token refresh response did not include an access token")
        return None
    next_access_token = next_access_token_raw.strip()

    next_refresh_token_raw = token_payload.get("refresh_token")
    next_refresh_token = (
        next_refresh_token_raw.strip()
        if isinstance(next_refresh_token_raw, str) and next_refresh_token_raw.strip()
        else refresh_token
    )

    token_expires_at = expires_at_from_payload(token_payload)

    _persist_refreshed_tokens(
        user=user,
        access_token=next_access_token,
        refresh_token=next_refresh_token,
        token_expires_at=token_expires_at,
        db=db,
    )
    return next_access_token


async def refresh_spotify_access_token(user: User, db: Session | None = None) -> str | None:
    """Refresh the Spotify access token for a user when possible."""
    refresh_token = (user.refresh_token or "").strip()
    if not refresh_token:
        return None
    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        logger.warning("Skipping Spotify token refresh because client credentials are missing")
        return None

    credentials = f"{settings.SPOTIFY_CLIENT_ID}:{settings.SPOTIFY_CLIENT_SECRET}".encode("utf-8")
    auth_header = base64.b64encode(credentials).decode("ascii")
    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    headers = {
        "Accept": "application/json",
        "Authorization": f"Basic {auth_header}",
    }
    try:
        async with httpx.AsyncClient(timeout=TOKEN_REFRESH_TIMEOUT_SECONDS) as client:
            response = await client.post(
                settings.SPOTIFY_TOKEN_URL,
                data=payload,
                headers=headers,
            )
    except Exception:
        logger.exception("Spotify token refresh request failed")
        return None

    if not response.is_success:
        logger.warning(
            "Spotify token refresh failed with status %s",
            response.status_code,
        )
        return None

    try:
        token_payload = response.json() if response.content else {}
    except ValueError:
        logger.warning("Spotify token refresh returned invalid JSON")
        return None
    if not isinstance(token_payload, dict):
        logger.warning("Spotify token refresh returned non-JSON payload")
        return None

    next_access_token_raw = token_payload.get("access_token")
    if not isinstance(next_access_token_raw, str) or not next_access_token_raw.strip():
        logger.warning("Spotify token refresh response did not include an access token")
        return None
    next_access_token = next_access_token_raw.strip()

    next_refresh_token_raw = token_payload.get("refresh_token")
    next_refresh_token = (
        next_refresh_token_raw.strip()
        if isinstance(next_refresh_token_raw, str) and next_refresh_token_raw.strip()
        else refresh_token
    )

    token_expires_at = expires_at_from_payload(token_payload)

    _persist_refreshed_tokens(
        user=user,
        access_token=next_access_token,
        refresh_token=next_refresh_token,
        token_expires_at=token_expires_at,
        db=db,
    )
    return next_access_token


async def refresh_tidal_access_token(user: User, db: Session | None = None) -> str | None:
    """Refresh the TIDAL access token for a user when possible."""
    refresh_token = (user.refresh_token or "").strip()
    if not refresh_token:
        return None
    if not settings.TIDAL_CLIENT_ID or not settings.TIDAL_CLIENT_SECRET:
        logger.warning("Skipping TIDAL token refresh because client credentials are missing")
        return None

    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": settings.TIDAL_CLIENT_ID,
        "client_secret": settings.TIDAL_CLIENT_SECRET,
    }
    headers = {
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=TOKEN_REFRESH_TIMEOUT_SECONDS) as client:
            response = await client.post(
                settings.TIDAL_TOKEN_URL,
                data=payload,
                headers=headers,
            )
    except Exception:
        logger.exception("TIDAL token refresh request failed")
        return None

    if not response.is_success:
        logger.warning(
            "TIDAL token refresh failed with status %s",
            response.status_code,
        )
        return None

    try:
        token_payload = response.json() if response.content else {}
    except ValueError:
        logger.warning("TIDAL token refresh returned invalid JSON")
        return None
    if not isinstance(token_payload, dict):
        logger.warning("TIDAL token refresh returned non-JSON payload")
        return None

    next_access_token_raw = token_payload.get("access_token")
    if not isinstance(next_access_token_raw, str) or not next_access_token_raw.strip():
        logger.warning("TIDAL token refresh response did not include an access token")
        return None
    next_access_token = next_access_token_raw.strip()

    next_refresh_token_raw = token_payload.get("refresh_token")
    next_refresh_token = (
        next_refresh_token_raw.strip()
        if isinstance(next_refresh_token_raw, str) and next_refresh_token_raw.strip()
        else refresh_token
    )

    token_expires_at = expires_at_from_payload(token_payload)

    _persist_refreshed_tokens(
        user=user,
        access_token=next_access_token,
        refresh_token=next_refresh_token,
        token_expires_at=token_expires_at,
        db=db,
    )
    return next_access_token


class ProviderClientWithRefresh:
    """Thin proxy that refreshes provider tokens once on auth failures."""

    def __init__(
        self,
        provider: str,
        user: User,
        db: Session | None = None,
    ) -> None:
        self._provider = provider.lower()
        self._user = user
        self._db = db if db is not None else object_session(user)
        access_token = user.access_token or ""
        self._client: MusicProviderClient = get_music_provider(self._provider, access_token)

    async def _refresh_access_token(self, *, force: bool = False) -> bool:
        if not force and not _is_expired(self._user.token_expires_at):
            return False
        if self._provider == "soundcloud":
            next_access_token = await refresh_soundcloud_access_token(self._user, self._db)
        elif self._provider == "spotify":
            next_access_token = await refresh_spotify_access_token(self._user, self._db)
        elif self._provider == "tidal":
            next_access_token = await refresh_tidal_access_token(self._user, self._db)
        else:
            return False
        if not next_access_token:
            return False
        self._client = get_music_provider(self._provider, next_access_token)
        return True

    def __getattr__(self, name: str):
        target = getattr(self._client, name)
        if not callable(target):
            return target
        if not inspect.iscoroutinefunction(target):
            return target

        async def _wrapped(*args, **kwargs):
            await self._refresh_access_token(force=False)
            current = getattr(self._client, name)
            try:
                return await current(*args, **kwargs)
            except ProviderAuthError:
                refreshed = await self._refresh_access_token(force=True)
                if not refreshed:
                    raise
                retry = getattr(self._client, name)
                return await retry(*args, **kwargs)

        return _wrapped


def get_provider_client_for_user(
    provider: str,
    user: User,
    db: Session | None = None,
) -> MusicProviderClient:
    """Build a provider client tied to a persisted user session."""
    if not user.access_token:
        raise ValueError("Missing provider access token")
    return cast(MusicProviderClient, ProviderClientWithRefresh(provider, user, db=db))
