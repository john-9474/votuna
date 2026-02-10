"""Generic SSO helpers for multiple providers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Mapping, Protocol, cast

from fastapi import Request, Response
from fastapi_sso.sso.soundcloud import SoundcloudSSO
from fastapi_sso.sso.spotify import SpotifySSO

from app.config.settings import settings

SPOTIFY_SCOPES = [
    "user-read-email",
    "user-read-private",
]

SOUNDCLOUD_SCOPES = [
    "non-expiring",
]


class OpenIDUserProtocol(Protocol):
    id: str | None
    sub: str | None
    email: str | None
    first_name: str | None
    last_name: str | None
    name: str | None
    display_name: str | None
    picture: str | None
    avatar_url: str | None
    username: str | None

    def model_dump(self) -> dict[str, Any]:
        """Return a dict representation of the user."""
        ...

    def dict(self) -> dict[str, Any]:
        """Return a dict representation of the user."""
        ...


class SSOProtocol(Protocol):
    access_token: str | None
    refresh_token: str | None
    expires_at: int | float | datetime | None

    async def get_login_redirect(self) -> Response:
        """Return a login redirect response for the provider."""
        ...

    async def verify_and_process(
        self,
        request: Request,
        *,
        params: Mapping[str, Any] | None = None,
        headers: Mapping[str, Any] | None = None,
        redirect_uri: str | None = None,
        convert_response: bool = True,
    ) -> OpenIDUserProtocol:
        """Verify the callback request and return the OpenID user."""
        ...

    async def __aenter__(self) -> "SSOProtocol":
        """Enter the async SSO context manager."""
        ...

    async def __aexit__(self, exc_type, exc, tb) -> None:
        """Exit the async SSO context manager."""
        ...


class AuthProvider(str, Enum):
    spotify = "spotify"
    soundcloud = "soundcloud"


@dataclass(frozen=True)
class ProviderConfig:
    provider: AuthProvider
    sso_class: type
    client_id: str
    client_secret: str
    redirect_uri: str
    scope: list[str]
    id_keys: tuple[str, ...]
    email_keys: tuple[str, ...]
    display_name_keys: tuple[str, ...]
    avatar_keys: tuple[str, ...]


def _require_settings(provider: AuthProvider, client_id: str, client_secret: str, redirect_uri: str) -> None:
    """Ensure required provider settings are present."""
    if not client_id or not client_secret or not redirect_uri:
        raise ValueError(f"{provider.value.capitalize()} SSO settings are missing")


def get_provider_config(provider: AuthProvider) -> ProviderConfig:
    """Return the provider configuration used to build the SSO client."""
    if provider is AuthProvider.spotify:
        return ProviderConfig(
            provider=provider,
            sso_class=SpotifySSO,
            client_id=settings.SPOTIFY_CLIENT_ID,
            client_secret=settings.SPOTIFY_CLIENT_SECRET,
            redirect_uri=settings.SPOTIFY_REDIRECT_URI,
            scope=SPOTIFY_SCOPES,
            id_keys=("id", "sub"),
            email_keys=("email",),
            display_name_keys=("name", "display_name"),
            avatar_keys=("picture", "avatar_url"),
        )

    if provider is AuthProvider.soundcloud:
        return ProviderConfig(
            provider=provider,
            sso_class=SoundcloudSSO,
            client_id=settings.SOUNDCLOUD_CLIENT_ID,
            client_secret=settings.SOUNDCLOUD_CLIENT_SECRET,
            redirect_uri=settings.SOUNDCLOUD_REDIRECT_URI,
            scope=SOUNDCLOUD_SCOPES,
            id_keys=("id", "sub"),
            email_keys=("email",),
            display_name_keys=("username", "name", "display_name"),
            avatar_keys=("avatar_url", "picture"),
        )

    raise ValueError(f"Unsupported provider: {provider}")


def get_sso(provider: AuthProvider) -> SSOProtocol:
    """Build and return an SSO client for the given provider."""
    config = get_provider_config(provider)
    _require_settings(provider, config.client_id, config.client_secret, config.redirect_uri)
    sso = config.sso_class(
        client_id=config.client_id,
        client_secret=config.client_secret,
        redirect_uri=config.redirect_uri,
        allow_insecure_http=settings.DEBUG,
        scope=config.scope,
        use_state=True,
    )
    return cast(SSOProtocol, sso)


def get_openid_value(openid: OpenIDUserProtocol | Mapping[str, Any], *keys: str) -> Any:
    """Extract the first truthy value for the given keys from an OpenID payload."""
    data: Mapping[str, Any] = {}

    model_dump = getattr(openid, "model_dump", None)
    if callable(model_dump):
        raw = model_dump()
        if isinstance(raw, dict):
            data = cast(Mapping[str, Any], raw)
    else:
        as_dict = getattr(openid, "dict", None)
        if callable(as_dict):
            raw = as_dict()
            if isinstance(raw, dict):
                data = cast(Mapping[str, Any], raw)
        elif isinstance(openid, Mapping):
            data = openid

    for key in keys:
        value = getattr(openid, key, None)
        if value:
            return value
        if data.get(key):
            return data.get(key)
    return None
