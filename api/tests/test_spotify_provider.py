import asyncio
from urllib.parse import parse_qs, urlparse

import httpx

from app.services.music_providers.spotify import SpotifyProvider


def _response(method: str, url: str, payload: dict | list, status_code: int = 200) -> httpx.Response:
    request = httpx.Request(method, url)
    return httpx.Response(status_code, request=request, json=payload)


def test_list_playlists_paginates_and_maps(monkeypatch):
    provider = SpotifyProvider("token")

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            parsed = urlparse(url)
            path = parsed.path
            query = parse_qs(parsed.query)

            if path.endswith("/me/playlists"):
                if query.get("offset") == ["50"]:
                    return _response(
                        "GET",
                        url,
                        {
                            "items": [
                                {
                                    "id": "pl-2",
                                    "name": "Playlist Two",
                                    "images": [{"url": "https://img.test/pl-2.jpg"}],
                                    "external_urls": {"spotify": "https://open.spotify.com/playlist/pl-2"},
                                    "tracks": {"total": 4},
                                    "public": False,
                                }
                            ],
                            "next": None,
                        },
                    )
                return _response(
                    "GET",
                    "https://api.spotify.com/v1/me/playlists",
                    {
                        "items": [
                            {
                                "id": "pl-1",
                                "name": "Playlist One",
                                "description": "First",
                                "images": [{"url": "https://img.test/pl-1.jpg"}],
                                "external_urls": {"spotify": "https://open.spotify.com/playlist/pl-1"},
                                "items": {"total": 2},
                                "public": True,
                            }
                        ],
                        "next": "https://api.spotify.com/v1/me/playlists?offset=50",
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    playlists = asyncio.run(provider.list_playlists())
    assert len(playlists) == 2
    assert playlists[0].provider_playlist_id == "pl-1"
    assert playlists[0].track_count == 2
    assert playlists[1].provider_playlist_id == "pl-2"


def test_get_playlist_and_resolve_playlist_url(monkeypatch):
    provider = SpotifyProvider("token")

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            parsed = urlparse(url)
            if parsed.path.endswith("/playlists/playlist-123"):
                return _response(
                    "GET",
                    "https://api.spotify.com/v1/playlists/playlist-123",
                    {
                        "id": "playlist-123",
                        "name": "Resolved Playlist",
                        "description": "From Spotify",
                        "images": [{"url": "https://img.test/playlist.jpg"}],
                        "external_urls": {"spotify": "https://open.spotify.com/playlist/playlist-123"},
                        "items": {"total": 9},
                        "public": True,
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    direct = asyncio.run(provider.get_playlist("playlist-123"))
    assert direct.provider_playlist_id == "playlist-123"
    assert direct.title == "Resolved Playlist"

    resolved = asyncio.run(provider.resolve_playlist_url("https://open.spotify.com/playlist/playlist-123?si=x"))
    assert resolved.provider_playlist_id == "playlist-123"


def test_create_playlist_uses_current_user(monkeypatch):
    provider = SpotifyProvider("token")
    captured: dict[str, object] = {}

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            if url == "/me":
                return _response("GET", "https://api.spotify.com/v1/me", {"id": "me-user"})
            raise AssertionError(f"Unexpected request to {url}")

        async def post(self, url: str, headers: dict, json: dict):
            captured["url"] = url
            captured["json"] = json
            return _response(
                "POST",
                "https://api.spotify.com/v1/users/me-user/playlists",
                {
                    "id": "created-playlist",
                    "name": json["name"],
                    "description": json["description"],
                    "images": [],
                    "external_urls": {"spotify": "https://open.spotify.com/playlist/created-playlist"},
                    "tracks": {"total": 0},
                    "public": json["public"],
                },
            )

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    playlist = asyncio.run(provider.create_playlist("My List", description="Desc", is_public=False))
    assert captured["url"] == "/users/me-user/playlists"
    assert captured["json"] == {"name": "My List", "description": "Desc", "public": False}
    assert playlist.provider_playlist_id == "created-playlist"
    assert playlist.track_count == 0


def test_list_tracks_and_add_remove_tracks(monkeypatch):
    provider = SpotifyProvider("token")
    captured: dict[str, object] = {}

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            parsed = urlparse(url)
            if parsed.path.endswith("/playlists/playlist-1/items"):
                if parse_qs(parsed.query).get("offset") == ["100"]:
                    return _response(
                        "GET",
                        url,
                        {"items": [], "next": None},
                    )
                return _response(
                    "GET",
                    "https://api.spotify.com/v1/playlists/playlist-1/items",
                    {
                        "items": [
                            {
                                "item": {
                                    "id": "track-1",
                                    "name": "Track One",
                                    "artists": [{"name": "Artist One"}],
                                    "album": {"images": [{"url": "https://img.test/track-1.jpg"}]},
                                    "external_urls": {"spotify": "https://open.spotify.com/track/track-1"},
                                }
                            },
                            {
                                "track": {
                                    "id": "track-2",
                                    "name": "Track Two",
                                    "artists": [{"name": "Artist Two"}],
                                    "album": {"images": [{"url": "https://img.test/track-2.jpg"}]},
                                    "external_urls": {"spotify": "https://open.spotify.com/track/track-2"},
                                }
                            },
                        ],
                        "next": "https://api.spotify.com/v1/playlists/playlist-1/items?offset=100",
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

        async def post(self, url: str, headers: dict, json: dict):
            captured["add_url"] = url
            captured["add_json"] = json
            return _response("POST", "https://api.spotify.com/v1/playlists/playlist-1/items", {"snapshot_id": "a"})

        async def request(self, method: str, url: str, headers: dict, json: dict):
            captured["delete_method"] = method
            captured["delete_url"] = url
            captured["delete_json"] = json
            return _response("DELETE", "https://api.spotify.com/v1/playlists/playlist-1/items", {"snapshot_id": "b"})

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    tracks = asyncio.run(provider.list_tracks("playlist-1"))
    assert len(tracks) == 2
    assert tracks[0].provider_track_id == "track-1"
    assert tracks[0].artist == "Artist One"
    assert tracks[1].provider_track_id == "track-2"
    assert tracks[1].artist == "Artist Two"

    asyncio.run(provider.add_tracks("spotify:playlist:playlist-1", ["track-1", "spotify:track:track-2", "track-1"]))
    assert captured["add_url"] == "/playlists/playlist-1/items"
    assert captured["add_json"] == {"uris": ["spotify:track:track-1", "spotify:track:track-2"]}

    asyncio.run(provider.remove_tracks("https://open.spotify.com/playlist/playlist-1", ["track-2"]))
    assert captured["delete_method"] == "DELETE"
    assert captured["delete_url"] == "/playlists/playlist-1/items"
    assert captured["delete_json"] == {"tracks": [{"uri": "spotify:track:track-2"}]}


def test_search_and_resolve_track_and_get_user(monkeypatch):
    provider = SpotifyProvider("token")

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            if url == "/search" and params and params.get("type") == "track":
                return _response(
                    "GET",
                    "https://api.spotify.com/v1/search?type=track",
                    {
                        "tracks": {
                            "items": [
                                {
                                    "id": "track-77",
                                    "name": "Search Track",
                                    "artists": [{"name": "Search Artist"}],
                                    "album": {"images": [{"url": "https://img.test/track-77.jpg"}]},
                                    "external_urls": {"spotify": "https://open.spotify.com/track/track-77"},
                                }
                            ]
                        }
                    },
                )
            if url == "/search" and params and params.get("type") == "playlist":
                return _response(
                    "GET",
                    "https://api.spotify.com/v1/search?type=playlist",
                    {
                        "playlists": {
                            "items": [
                                {
                                    "id": "playlist-88",
                                    "name": "Search Playlist",
                                    "images": [{"url": "https://img.test/pl-88.jpg"}],
                                    "external_urls": {"spotify": "https://open.spotify.com/playlist/playlist-88"},
                                    "items": {"total": 3},
                                    "public": True,
                                }
                            ]
                        }
                    },
                )
            if url == "/tracks/track-77":
                return _response(
                    "GET",
                    "https://api.spotify.com/v1/tracks/track-77",
                    {
                        "id": "track-77",
                        "name": "Resolved Track",
                        "artists": [{"name": "Resolved Artist"}],
                        "album": {"images": [{"url": "https://img.test/track-77.jpg"}]},
                        "external_urls": {"spotify": "https://open.spotify.com/track/track-77"},
                    },
                )
            if url == "/users/user-11":
                return _response(
                    "GET",
                    "https://api.spotify.com/v1/users/user-11",
                    {
                        "id": "user-11",
                        "display_name": "Spotify User",
                        "images": [{"url": "https://img.test/user-11.jpg"}],
                        "external_urls": {"spotify": "https://open.spotify.com/user/user-11"},
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    track_results = asyncio.run(provider.search_tracks("search", limit=5))
    assert len(track_results) == 1
    assert track_results[0].provider_track_id == "track-77"

    playlist_results = asyncio.run(provider.search_playlists("search", limit=5))
    assert len(playlist_results) == 1
    assert playlist_results[0].provider_playlist_id == "playlist-88"

    resolved_track = asyncio.run(provider.resolve_track_url("spotify:track:track-77"))
    assert resolved_track.provider_track_id == "track-77"
    assert resolved_track.title == "Resolved Track"

    provider_user = asyncio.run(provider.get_user("https://open.spotify.com/user/user-11"))
    assert provider_user.provider_user_id == "user-11"
    assert provider_user.profile_url == "https://open.spotify.com/user/user-11"


def test_related_tracks_and_search_users_are_safe_noops():
    provider = SpotifyProvider("token")
    assert asyncio.run(provider.related_tracks("track-1")) == []
    assert asyncio.run(provider.search_users("anything")) == []
