import asyncio

import httpx

from app.crud.user import user_crud
from app.services.music_providers import session as provider_session


def test_refresh_spotify_access_token_updates_user_and_preserves_refresh_token(db_session, user, monkeypatch):
    monkeypatch.setattr(provider_session.settings, "SPOTIFY_CLIENT_ID", "spotify-client-id")
    monkeypatch.setattr(provider_session.settings, "SPOTIFY_CLIENT_SECRET", "spotify-client-secret")
    monkeypatch.setattr(provider_session.settings, "SPOTIFY_TOKEN_URL", "https://accounts.spotify.com/api/token")

    user = user_crud.update(
        db_session,
        user,
        {
            "access_token": "expired-access-token",
            "refresh_token": "existing-refresh-token",
            "token_expires_at": None,
        },
    )

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url: str, data: dict, headers: dict):
            assert url == "https://accounts.spotify.com/api/token"
            assert data["grant_type"] == "refresh_token"
            assert data["refresh_token"] == "existing-refresh-token"
            assert headers.get("Authorization", "").startswith("Basic ")
            return httpx.Response(
                200,
                request=httpx.Request("POST", url),
                json={
                    "access_token": "fresh-access-token",
                    "expires_in": 3600,
                },
            )

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    refreshed = asyncio.run(provider_session.refresh_spotify_access_token(user, db_session))
    assert refreshed == "fresh-access-token"

    updated_user = user_crud.get(db_session, user.id)
    assert updated_user is not None
    assert updated_user.access_token == "fresh-access-token"
    assert updated_user.refresh_token == "existing-refresh-token"
    assert updated_user.token_expires_at is not None


def test_refresh_spotify_access_token_returns_none_on_http_failure(db_session, user, monkeypatch):
    monkeypatch.setattr(provider_session.settings, "SPOTIFY_CLIENT_ID", "spotify-client-id")
    monkeypatch.setattr(provider_session.settings, "SPOTIFY_CLIENT_SECRET", "spotify-client-secret")
    monkeypatch.setattr(provider_session.settings, "SPOTIFY_TOKEN_URL", "https://accounts.spotify.com/api/token")

    user = user_crud.update(
        db_session,
        user,
        {
            "access_token": "expired-access-token",
            "refresh_token": "existing-refresh-token",
            "token_expires_at": None,
        },
    )

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url: str, data: dict, headers: dict):
            return httpx.Response(
                400,
                request=httpx.Request("POST", url),
                json={"error": "invalid_grant"},
            )

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    refreshed = asyncio.run(provider_session.refresh_spotify_access_token(user, db_session))
    assert refreshed is None

    updated_user = user_crud.get(db_session, user.id)
    assert updated_user is not None
    assert updated_user.access_token == "expired-access-token"
    assert updated_user.refresh_token == "existing-refresh-token"


def test_refresh_tidal_access_token_updates_user_and_preserves_refresh_token(db_session, user, monkeypatch):
    monkeypatch.setattr(provider_session.settings, "TIDAL_CLIENT_ID", "tidal-client-id")
    monkeypatch.setattr(provider_session.settings, "TIDAL_CLIENT_SECRET", "tidal-client-secret")
    monkeypatch.setattr(provider_session.settings, "TIDAL_TOKEN_URL", "https://auth.tidal.com/v1/oauth2/token")

    user = user_crud.update(
        db_session,
        user,
        {
            "access_token": "expired-access-token",
            "refresh_token": "existing-refresh-token",
            "token_expires_at": None,
        },
    )

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url: str, data: dict, headers: dict):
            assert url == "https://auth.tidal.com/v1/oauth2/token"
            assert data["grant_type"] == "refresh_token"
            assert data["refresh_token"] == "existing-refresh-token"
            assert data["client_id"] == "tidal-client-id"
            assert data["client_secret"] == "tidal-client-secret"
            assert headers.get("Accept") == "application/json"
            return httpx.Response(
                200,
                request=httpx.Request("POST", url),
                json={
                    "access_token": "fresh-access-token",
                    "expires_in": 3600,
                },
            )

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    refreshed = asyncio.run(provider_session.refresh_tidal_access_token(user, db_session))
    assert refreshed == "fresh-access-token"

    updated_user = user_crud.get(db_session, user.id)
    assert updated_user is not None
    assert updated_user.access_token == "fresh-access-token"
    assert updated_user.refresh_token == "existing-refresh-token"
    assert updated_user.token_expires_at is not None


def test_refresh_tidal_access_token_returns_none_on_http_failure(db_session, user, monkeypatch):
    monkeypatch.setattr(provider_session.settings, "TIDAL_CLIENT_ID", "tidal-client-id")
    monkeypatch.setattr(provider_session.settings, "TIDAL_CLIENT_SECRET", "tidal-client-secret")
    monkeypatch.setattr(provider_session.settings, "TIDAL_TOKEN_URL", "https://auth.tidal.com/v1/oauth2/token")

    user = user_crud.update(
        db_session,
        user,
        {
            "access_token": "expired-access-token",
            "refresh_token": "existing-refresh-token",
            "token_expires_at": None,
        },
    )

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url: str, data: dict, headers: dict):
            return httpx.Response(
                400,
                request=httpx.Request("POST", url),
                json={"error": "invalid_grant"},
            )

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    refreshed = asyncio.run(provider_session.refresh_tidal_access_token(user, db_session))
    assert refreshed is None

    updated_user = user_crud.get(db_session, user.id)
    assert updated_user is not None
    assert updated_user.access_token == "expired-access-token"
    assert updated_user.refresh_token == "existing-refresh-token"
