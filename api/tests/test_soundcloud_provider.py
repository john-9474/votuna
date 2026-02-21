import asyncio

import httpx
import pytest

from app.services.music_providers.base import ProviderAPIError, ProviderTrack
from app.services.music_providers.soundcloud import SoundcloudProvider


def test_extract_handle_query_variants():
    provider = SoundcloudProvider("token")
    assert provider._extract_handle_query("@dj-sets") == "dj-sets"
    assert provider._extract_handle_query("https://soundcloud.com/dj-sets") == "dj-sets"
    assert provider._extract_handle_query("soundcloud.com/dj-sets") == "dj-sets"
    assert provider._extract_handle_query("display name with spaces") is None


def test_to_provider_user_maps_handle_and_display_name():
    provider = SoundcloudProvider("token")
    mapped = provider._to_provider_user(
        {
            "id": 123,
            "username": "Display Name",
            "permalink": "dj-handle",
            "permalink_url": "https://soundcloud.com/dj-handle",
            "avatar_url": "https://img.example/avatar.jpg",
        }
    )
    assert mapped is not None
    assert mapped.provider_user_id == "123"
    assert mapped.username == "dj-handle"
    assert mapped.display_name == "Display Name"
    assert mapped.profile_url == "https://soundcloud.com/dj-handle"


def test_to_provider_track_uses_id_from_urn_when_id_is_missing():
    provider = SoundcloudProvider("token")
    mapped = provider._to_provider_track(
        {
            "urn": "urn:soundcloud:tracks:999",
            "title": "URN Track",
            "user": {"username": "Artist"},
            "permalink_url": "https://soundcloud.com/test/urn-track",
        }
    )

    assert mapped is not None
    assert mapped.provider_track_id == "999"
    assert mapped.title == "URN Track"


def test_add_tracks_sends_id_references_without_urn(monkeypatch):
    provider = SoundcloudProvider("token")
    captured: dict[str, object] = {}
    playlist_payload = {
        "title": "Test Playlist",
        "tracks": [
            {"id": "123"},
            {"urn": "urn:soundcloud:tracks:555"},
        ],
    }

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict):
            request = httpx.Request("GET", f"https://api.soundcloud.com{url}")
            return httpx.Response(200, request=request, json=playlist_payload)

        async def put(self, url: str, headers: dict, params: dict, json: dict):
            captured["json"] = json
            request = httpx.Request("PUT", f"https://api.soundcloud.com{url}")
            return httpx.Response(200, request=request, json={"ok": True})

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    asyncio.run(
        provider.add_tracks(
            "playlist-1",
            [
                "9223372036854775808",
                "urn:soundcloud:tracks:555",  # duplicate of existing via URN
                "urn:soundcloud:tracks:777",
            ],
        )
    )

    payload = captured["json"]
    assert isinstance(payload, dict)
    tracks = payload["playlist"]["tracks"]
    assert {"id": "123"} in tracks
    assert {"id": "555"} in tracks
    assert {"id": "9223372036854775808"} in tracks
    assert {"id": "777"} in tracks
    assert all("urn" not in track for track in tracks)
    assert tracks.count({"id": "555"}) == 1


def test_track_exists_matches_id_against_urn():
    provider = SoundcloudProvider("token")

    async def _list_tracks(_playlist_id: str):
        return [
            ProviderTrack(
                provider_track_id="urn:soundcloud:tracks:42",
                title="Track 42",
            )
        ]

    provider.list_tracks = _list_tracks  # type: ignore[method-assign]

    assert asyncio.run(provider.track_exists("playlist-1", "42")) is True
    assert asyncio.run(provider.track_exists("playlist-1", "urn:soundcloud:tracks:42")) is True
    assert asyncio.run(provider.track_exists("playlist-1", "43")) is False


def test_resolve_track_url_uses_follow_redirects(monkeypatch):
    provider = SoundcloudProvider("token")
    captured: dict[str, object] = {}

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            captured["follow_redirects"] = kwargs.get("follow_redirects")

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict):
            request = httpx.Request("GET", f"https://api.soundcloud.com{url}")
            return httpx.Response(
                200,
                request=request,
                json={
                    "kind": "track",
                    "id": 321,
                    "title": "Resolved Redirected Track",
                    "user": {"username": "Artist"},
                    "permalink_url": "https://soundcloud.com/test/resolved-redirected-track",
                },
            )

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    mapped = asyncio.run(provider.resolve_track_url("https://soundcloud.com/test/resolved-redirected-track"))
    assert captured["follow_redirects"] is True
    assert mapped.provider_track_id == "321"


def test_shuffle_playlist_reorders_tracks_and_preserves_duplicates(monkeypatch):
    provider = SoundcloudProvider("token")
    captured: dict[str, object] = {}

    def _shuffle(_self, values: list[dict[str, str]]) -> None:
        values[:] = [values[3], values[0], values[1], values[2]]

    monkeypatch.setattr("app.services.music_providers.soundcloud.random.SystemRandom.shuffle", _shuffle)

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict):
            request = httpx.Request("GET", f"https://api.soundcloud.com{url}")
            return httpx.Response(
                200,
                request=request,
                json={
                    "id": "playlist-1",
                    "title": "Test Playlist",
                    "tracks": [
                        {"id": "101"},
                        {"id": "202"},
                        {"urn": "urn:soundcloud:tracks:202"},
                        {"id": "303"},
                    ],
                },
            )

        async def put(self, url: str, headers: dict, params: dict, json: dict):
            captured["json"] = json
            request = httpx.Request("PUT", f"https://api.soundcloud.com{url}")
            return httpx.Response(200, request=request, json={"ok": True})

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    result = asyncio.run(provider.shuffle_playlist("playlist-1", max_items=500))

    assert result.status == "completed"
    assert result.total_items == 4
    assert result.moved_items == 3
    assert result.error is None
    payload = captured["json"]
    assert isinstance(payload, dict)
    tracks = payload["playlist"]["tracks"]
    assert tracks == [
        {"id": "303"},
        {"id": "101"},
        {"id": "202"},
        {"id": "202"},
    ]
    assert tracks.count({"id": "202"}) == 2


def test_shuffle_playlist_returns_partial_failure_when_update_fails(monkeypatch):
    provider = SoundcloudProvider("token")

    def _shuffle(_self, values: list[dict[str, str]]) -> None:
        values[:] = [values[2], values[0], values[1]]

    monkeypatch.setattr("app.services.music_providers.soundcloud.random.SystemRandom.shuffle", _shuffle)

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict):
            request = httpx.Request("GET", f"https://api.soundcloud.com{url}")
            return httpx.Response(
                200,
                request=request,
                json={
                    "id": "playlist-1",
                    "title": "Test Playlist",
                    "tracks": [{"id": "1"}, {"id": "2"}, {"id": "3"}],
                },
            )

        async def put(self, url: str, headers: dict, params: dict, json: dict):
            request = httpx.Request("PUT", f"https://api.soundcloud.com{url}")
            return httpx.Response(500, request=request, json={"error": "update failed"})

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    result = asyncio.run(provider.shuffle_playlist("playlist-1", max_items=500))

    assert result.status == "partial_failure"
    assert result.total_items == 3
    assert result.moved_items == 3
    assert "SoundCloud API error" in (result.error or "")


def test_shuffle_playlist_validates_max_items(monkeypatch):
    provider = SoundcloudProvider("token")

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict):
            request = httpx.Request("GET", f"https://api.soundcloud.com{url}")
            return httpx.Response(
                200,
                request=request,
                json={"id": "playlist-1", "title": "Test Playlist", "tracks": [{"id": "1"}] * 501},
            )

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    with pytest.raises(ProviderAPIError) as exc:
        asyncio.run(provider.shuffle_playlist("playlist-1", max_items=500))
    assert exc.value.status_code == 400
