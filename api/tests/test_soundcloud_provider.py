import asyncio

import httpx

from app.services.music_providers.base import ProviderTrack
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


def test_to_provider_track_uses_urn_when_id_is_missing():
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
    assert mapped.provider_track_id == "urn:soundcloud:tracks:999"
    assert mapped.title == "URN Track"


def test_add_tracks_sends_string_and_urn_references_without_int_cast(monkeypatch):
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
    assert {"urn": "urn:soundcloud:tracks:555"} in tracks
    assert {"id": "9223372036854775808"} in tracks
    assert {"urn": "urn:soundcloud:tracks:777"} in tracks
    assert tracks.count({"urn": "urn:soundcloud:tracks:555"}) == 1


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
