import asyncio
import time
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from app.config.settings import settings
from app.services.music_providers.apple import AppleMusicProvider
from app.services.music_providers.base import ProviderAPIError, ProviderAuthError


def _response(method: str, url: str, payload: dict | list, status_code: int = 200) -> httpx.Response:
    request = httpx.Request(method, url)
    return httpx.Response(status_code, request=request, json=payload)


def test_list_playlists_paginates_and_maps(monkeypatch):
    monkeypatch.setattr(settings, "APPLE_MUSIC_DEVELOPER_TOKEN", "dev-token")
    provider = AppleMusicProvider("user-token")

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            assert headers["Authorization"] == "Bearer dev-token"
            assert headers["Music-User-Token"] == "user-token"
            parsed = urlparse(url)
            if parsed.path == "/v1/me/library/playlists" and params and params.get("offset") == 0:
                return _response(
                    "GET",
                    "https://api.music.apple.com/v1/me/library/playlists",
                    {
                        "data": [
                            {
                                "id": "lib-1",
                                "attributes": {
                                    "name": "Library One",
                                    "description": {"standard": "First list"},
                                    "trackCount": 3,
                                    "isPublic": True,
                                    "url": "https://music.apple.com/library/playlist/lib-1",
                                    "artwork": {
                                        "url": "https://img.test/{w}x{h}.jpg",
                                        "width": 300,
                                        "height": 300,
                                    },
                                },
                            }
                        ],
                        "next": "/v1/me/library/playlists?offset=100",
                    },
                )
            if parsed.path == "/v1/me/library/playlists" and parse_qs(parsed.query).get("offset") == ["100"]:
                return _response(
                    "GET",
                    "https://api.music.apple.com/v1/me/library/playlists?offset=100",
                    {
                        "data": [
                            {
                                "id": "lib-2",
                                "attributes": {
                                    "name": "Library Two",
                                    "trackCount": 1,
                                },
                            }
                        ],
                        "next": None,
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    playlists = asyncio.run(provider.list_playlists())
    assert len(playlists) == 2
    assert playlists[0].provider_playlist_id == "lib-1"
    assert playlists[0].title == "Library One"
    assert playlists[0].description == "First list"
    assert playlists[0].track_count == 3
    assert playlists[0].is_public is True
    assert playlists[0].image_url == "https://img.test/300x300.jpg"
    assert playlists[1].provider_playlist_id == "lib-2"
    assert playlists[1].url == "https://music.apple.com/library/playlist/lib-2"


def test_get_playlist_catalog_and_resolve_url(monkeypatch):
    monkeypatch.setattr(settings, "APPLE_MUSIC_DEVELOPER_TOKEN", "dev-token")
    provider = AppleMusicProvider("user-token")
    requested_paths: list[str] = []

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            parsed = urlparse(url)
            requested_paths.append(parsed.path)
            if parsed.path == "/v1/catalog/us/playlists/pl.catalog-1":
                return _response(
                    "GET",
                    "https://api.music.apple.com/v1/catalog/us/playlists/pl.catalog-1",
                    {"data": [{"id": "pl.catalog-1", "attributes": {"name": "Catalog Playlist"}}]},
                )
            if parsed.path == "/v1/me/library/playlists/lib-1":
                return _response(
                    "GET",
                    "https://api.music.apple.com/v1/me/library/playlists/lib-1",
                    {"data": [{"id": "lib-1", "attributes": {"name": "Library Playlist"}}]},
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    catalog = asyncio.run(provider.get_playlist("pl.catalog-1"))
    assert catalog.provider_playlist_id == "pl.catalog-1"
    assert catalog.title == "Catalog Playlist"

    resolved = asyncio.run(provider.resolve_playlist_url("https://music.apple.com/us/playlist/pl.catalog-1"))
    assert resolved.provider_playlist_id == "pl.catalog-1"

    library = asyncio.run(provider.get_playlist("lib-1"))
    assert library.provider_playlist_id == "lib-1"
    assert library.title == "Library Playlist"

    assert "/v1/catalog/us/playlists/pl.catalog-1" in requested_paths
    assert "/v1/me/library/playlists/lib-1" in requested_paths


def test_create_playlist_and_add_tracks_normalize_and_dedupe(monkeypatch):
    monkeypatch.setattr(settings, "APPLE_MUSIC_DEVELOPER_TOKEN", "dev-token")
    provider = AppleMusicProvider("user-token")
    captured: dict[str, object] = {}

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url: str, headers: dict, json: dict):
            if url == "/v1/me/library/playlists":
                captured["create_json"] = json
                return _response(
                    "POST",
                    "https://api.music.apple.com/v1/me/library/playlists",
                    {"data": [{"id": "p1", "attributes": {"name": "My List", "description": {"standard": "Desc"}}}]},
                )
            if url == "/v1/me/library/playlists/p1/tracks":
                captured["add_json"] = json
                request = httpx.Request("POST", "https://api.music.apple.com/v1/me/library/playlists/p1/tracks")
                return httpx.Response(204, request=request)
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    created = asyncio.run(provider.create_playlist("My List", description="Desc", is_public=True))
    assert created.provider_playlist_id == "p1"
    assert captured["create_json"] == {"attributes": {"name": "My List", "description": "Desc"}}

    asyncio.run(
        provider.add_tracks(
            "p1",
            [
                "apple:songs:111",
                "songs:111",
                "https://music.apple.com/us/album/test/123?i=222",
                "i.333",
            ],
        )
    )
    assert captured["add_json"] == {
        "data": [
            {"id": "111", "type": "songs"},
            {"id": "222", "type": "songs"},
            {"id": "i.333", "type": "library-songs"},
        ]
    }


def test_search_tracks_and_resolve_track_urls(monkeypatch):
    monkeypatch.setattr(settings, "APPLE_MUSIC_DEVELOPER_TOKEN", "dev-token")
    monkeypatch.setattr(settings, "APPLE_MUSIC_STOREFRONT", "us")
    provider = AppleMusicProvider("user-token")
    requested_paths: list[str] = []

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            parsed = urlparse(url)
            requested_paths.append(parsed.path)
            if parsed.path == "/v1/catalog/us/search":
                return _response(
                    "GET",
                    "https://api.music.apple.com/v1/catalog/us/search",
                    {
                        "results": {
                            "songs": {
                                "data": [
                                    {
                                        "id": "11",
                                        "attributes": {
                                            "name": "Search Track",
                                            "artistName": "Search Artist",
                                            "url": "https://music.apple.com/us/song/search-track/11",
                                        },
                                    }
                                ]
                            }
                        }
                    },
                )
            if parsed.path == "/v1/catalog/us/songs/11":
                return _response(
                    "GET",
                    "https://api.music.apple.com/v1/catalog/us/songs/11",
                    {
                        "data": [
                            {
                                "id": "11",
                                "attributes": {
                                    "name": "Resolved Catalog Track",
                                    "artistName": "Catalog Artist",
                                },
                            }
                        ]
                    },
                )
            if parsed.path == "/v1/me/library/songs/i.333":
                return _response(
                    "GET",
                    "https://api.music.apple.com/v1/me/library/songs/i.333",
                    {
                        "data": [
                            {"id": "i.333", "attributes": {"name": "Library Track", "artistName": "Library Artist"}}
                        ]
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    results = asyncio.run(provider.search_tracks("search", limit=8))
    assert len(results) == 1
    assert results[0].provider_track_id == "11"
    assert results[0].title == "Search Track"

    resolved_catalog = asyncio.run(provider.resolve_track_url("https://music.apple.com/us/album/x/123?i=11"))
    assert resolved_catalog.provider_track_id == "11"
    assert resolved_catalog.title == "Resolved Catalog Track"

    resolved_library = asyncio.run(provider.resolve_track_url("i.333"))
    assert resolved_library.provider_track_id == "i.333"
    assert resolved_library.title == "Library Track"

    assert "/v1/catalog/us/search" in requested_paths
    assert "/v1/catalog/us/songs/11" in requested_paths
    assert "/v1/me/library/songs/i.333" in requested_paths


def test_remove_and_user_apis_are_explicitly_unsupported(monkeypatch):
    monkeypatch.setattr(settings, "APPLE_MUSIC_DEVELOPER_TOKEN", "dev-token")
    provider = AppleMusicProvider("user-token")

    with pytest.raises(ProviderAPIError) as exc:
        asyncio.run(provider.remove_tracks("playlist-1", ["track-1"]))
    assert exc.value.status_code == 501

    assert asyncio.run(provider.search_users("user")) == []

    with pytest.raises(ProviderAPIError) as user_exc:
        asyncio.run(provider.get_user("u1"))
    assert user_exc.value.status_code == 501


def test_list_playlists_raises_provider_auth_error_on_unauthorized(monkeypatch):
    monkeypatch.setattr(settings, "APPLE_MUSIC_DEVELOPER_TOKEN", "dev-token")
    provider = AppleMusicProvider("user-token")

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            return _response(
                "GET",
                "https://api.music.apple.com/v1/me/library/playlists",
                {"errors": [{"title": "Unauthorized"}]},
                status_code=401,
            )

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    with pytest.raises(ProviderAuthError):
        asyncio.run(provider.list_playlists())


def test_get_developer_token_uses_cache_when_not_static(monkeypatch):
    monkeypatch.setattr(settings, "APPLE_MUSIC_DEVELOPER_TOKEN", "")
    AppleMusicProvider._developer_token_cache = None
    generated = {"calls": 0}

    def _generate() -> tuple[str, float]:
        generated["calls"] += 1
        return "generated-token", time.time() + 3600

    monkeypatch.setattr(AppleMusicProvider, "_generate_developer_token", staticmethod(_generate))
    provider = AppleMusicProvider("user-token")

    first = asyncio.run(provider._get_developer_token())
    second = asyncio.run(provider._get_developer_token())
    assert first == "generated-token"
    assert second == "generated-token"
    assert generated["calls"] == 1
