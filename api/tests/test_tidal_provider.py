import asyncio
from urllib.parse import quote, urlparse

import httpx
import pytest

from app.config.settings import settings
from app.services.music_providers.base import ProviderAPIError, ProviderAuthError
from app.services.music_providers.tidal import TidalProvider


def _response(method: str, url: str, payload: dict | list, status_code: int = 200) -> httpx.Response:
    request = httpx.Request(method, url)
    return httpx.Response(status_code, request=request, json=payload)


def _playlist_items_payload() -> dict:
    return {
        "data": [
            {"id": "track-1", "type": "tracks", "meta": {"itemId": "11111111-1111-1111-1111-111111111111"}},
            {"id": "track-2", "type": "tracks", "meta": {"itemId": "22222222-2222-2222-2222-222222222222"}},
        ],
        "included": [
            {
                "id": "track-1",
                "type": "tracks",
                "attributes": {
                    "title": "Track One",
                    "externalLinks": [
                        {
                            "href": "https://listen.tidal.com/track/track-1",
                            "meta": {"type": "TIDAL_SHARING"},
                        }
                    ],
                },
                "relationships": {"artists": {"data": [{"type": "artists", "id": "artist-1"}]}},
            },
            {
                "id": "track-2",
                "type": "tracks",
                "attributes": {
                    "title": "Track Two",
                    "externalLinks": [
                        {
                            "href": "https://listen.tidal.com/track/track-2",
                            "meta": {"type": "TIDAL_SHARING"},
                        }
                    ],
                },
                "relationships": {"artists": {"data": [{"type": "artists", "id": "artist-2"}]}},
            },
            {"id": "artist-1", "type": "artists", "attributes": {"name": "Artist One"}},
            {"id": "artist-2", "type": "artists", "attributes": {"name": "Artist Two"}},
        ],
        "next": None,
    }


def _empty_playlist_items_payload() -> dict:
    return {
        "data": [],
        "included": [],
        "next": None,
    }


def _playlist_items_with_non_uuid_item_id_payload() -> dict:
    return {
        "data": [
            {"id": "track-1", "type": "tracks", "meta": {"itemId": "not-a-uuid"}},
        ],
        "included": [],
        "next": None,
    }


def _playlist_items_ids_only_payload() -> dict:
    return {
        "data": [
            {"id": "track-1", "type": "tracks", "meta": {"itemId": "11111111-1111-1111-1111-111111111111"}},
            {"id": "track-2", "type": "tracks", "meta": {"itemId": "22222222-2222-2222-2222-222222222222"}},
        ],
        "included": [],
        "next": None,
    }


def test_list_playlists_fetches_current_user_and_maps(monkeypatch):
    monkeypatch.setattr(settings, "TIDAL_COUNTRY_CODE", "US")
    provider = TidalProvider("access-token")

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            parsed = urlparse(url)
            if parsed.path == "/users/me":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/users/me",
                    {"data": {"id": "me-1", "type": "users"}},
                )
            if parsed.path == "/playlists":
                assert params is not None
                assert params.get("filter[owners.id]") == "me-1"
                assert params.get("countryCode") == "US"
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/playlists",
                    {
                        "data": [
                            {
                                "id": "pl-1",
                                "type": "playlists",
                                "attributes": {
                                    "name": "My TIDAL List",
                                    "description": "desc",
                                    "numberOfItems": 4,
                                    "accessType": "PUBLIC",
                                    "externalLinks": [
                                        {
                                            "href": "https://listen.tidal.com/playlist/pl-1",
                                            "meta": {"type": "TIDAL_SHARING"},
                                        }
                                    ],
                                },
                            }
                        ],
                        "next": None,
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    playlists = asyncio.run(provider.list_playlists())
    assert len(playlists) == 1
    assert playlists[0].provider_playlist_id == "pl-1"
    assert playlists[0].title == "My TIDAL List"
    assert playlists[0].track_count == 4
    assert playlists[0].is_public is True


def test_get_resolve_and_create_playlist(monkeypatch):
    monkeypatch.setattr(settings, "TIDAL_COUNTRY_CODE", "")
    provider = TidalProvider("access-token")
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
            if parsed.path == "/playlists/pl-1":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/playlists/pl-1",
                    {
                        "data": {
                            "id": "pl-1",
                            "type": "playlists",
                            "attributes": {"name": "Resolved Playlist", "accessType": "UNLISTED"},
                        }
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

        async def post(self, url: str, headers: dict, params: dict, json: dict):
            captured["url"] = url
            captured["json"] = json
            return _response(
                "POST",
                "https://openapi.tidal.com/v2/playlists",
                {
                    "data": {
                        "id": "created-1",
                        "type": "playlists",
                        "attributes": {"name": "Created List", "accessType": "UNLISTED"},
                    }
                },
            )

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    direct = asyncio.run(provider.get_playlist("pl-1"))
    assert direct.provider_playlist_id == "pl-1"
    assert direct.title == "Resolved Playlist"

    resolved = asyncio.run(provider.resolve_playlist_url("https://listen.tidal.com/playlist/pl-1"))
    assert resolved.provider_playlist_id == "pl-1"

    created = asyncio.run(provider.create_playlist("Created List", description="Desc", is_public=False))
    assert created.provider_playlist_id == "created-1"
    assert captured["url"] == "/playlists"
    assert captured["json"] == {
        "data": {
            "type": "playlists",
            "attributes": {
                "name": "Created List",
                "description": "Desc",
                "accessType": "UNLISTED",
            },
        }
    }


def test_list_tracks_add_tracks_and_remove_tracks(monkeypatch):
    monkeypatch.setattr(settings, "TIDAL_COUNTRY_CODE", "")
    provider = TidalProvider("access-token")
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
            if parsed.path == "/playlists/pl-1/relationships/items":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/playlists/pl-1/relationships/items",
                    _playlist_items_payload(),
                )
            raise AssertionError(f"Unexpected request to {url}")

        async def post(self, url: str, headers: dict, params: dict, json: dict):
            captured["add_url"] = url
            captured["add_json"] = json
            request = httpx.Request("POST", "https://openapi.tidal.com/v2/playlists/pl-1/relationships/items")
            return httpx.Response(204, request=request)

        async def request(self, method: str, url: str, headers: dict, json: dict):
            captured["delete_method"] = method
            captured["delete_url"] = url
            captured["delete_json"] = json
            request = httpx.Request("DELETE", "https://openapi.tidal.com/v2/playlists/pl-1/relationships/items")
            return httpx.Response(204, request=request)

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    tracks = asyncio.run(provider.list_tracks("pl-1"))
    assert len(tracks) == 2
    assert tracks[0].provider_track_id == "track-1"
    assert tracks[0].artist == "Artist One"

    asyncio.run(
        provider.add_tracks(
            "tidal:playlist:pl-1",
            [
                "tidal:tracks:track-3",
                "track-3",
                "https://listen.tidal.com/track/track-4",
            ],
        )
    )
    assert captured["add_url"] == "/playlists/pl-1/relationships/items"
    assert captured["add_json"] == {
        "data": [
            {"id": "track-3", "type": "tracks"},
            {"id": "track-4", "type": "tracks"},
        ],
        "meta": {"positionBefore": "11111111-1111-1111-1111-111111111111"},
    }

    asyncio.run(provider.remove_tracks("pl-1", ["track-2"]))
    assert captured["delete_method"] == "DELETE"
    assert captured["delete_url"] == "/playlists/pl-1/relationships/items"
    assert captured["delete_json"] == {
        "data": [
            {
                "id": "track-2",
                "type": "tracks",
                "meta": {"itemId": "22222222-2222-2222-2222-222222222222"},
            }
        ]
    }


def test_list_tracks_enriches_metadata_when_items_payload_has_only_ids(monkeypatch):
    monkeypatch.setattr(settings, "TIDAL_COUNTRY_CODE", "")
    provider = TidalProvider("access-token")

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            parsed = urlparse(url)
            if parsed.path == "/playlists/pl-ids/relationships/items":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/playlists/pl-ids/relationships/items",
                    _playlist_items_ids_only_payload(),
                )
            if parsed.path == "/tracks/track-1":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/tracks/track-1",
                    {
                        "data": {
                            "id": "track-1",
                            "type": "tracks",
                            "attributes": {"title": "Track One"},
                            "relationships": {
                                "artists": {"data": [{"type": "artists", "id": "artist-1"}]},
                                "albums": {"data": [{"type": "albums", "id": "album-1"}]},
                            },
                        },
                        "included": [
                            {"id": "artist-1", "type": "artists", "attributes": {"name": "Artist One"}},
                            {
                                "id": "album-1",
                                "type": "albums",
                                "relationships": {"coverArt": {"data": [{"type": "artworks", "id": "art-1"}]}},
                            },
                            {
                                "id": "art-1",
                                "type": "artworks",
                                "attributes": {
                                    "files": [{"href": "https://resources.tidal.com/images/art-1/640x640.jpg"}]
                                },
                            },
                        ],
                    },
                )
            if parsed.path == "/tracks/track-2":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/tracks/track-2",
                    {
                        "data": {
                            "id": "track-2",
                            "type": "tracks",
                            "attributes": {"title": "Track Two"},
                            "relationships": {
                                "artists": {"data": [{"type": "artists", "id": "artist-2"}]},
                                "albums": {"data": [{"type": "albums", "id": "album-2"}]},
                            },
                        },
                        "included": [
                            {"id": "artist-2", "type": "artists", "attributes": {"name": "Artist Two"}},
                            {
                                "id": "album-2",
                                "type": "albums",
                                "relationships": {"coverArt": {"data": [{"type": "artworks", "id": "art-2"}]}},
                            },
                            {
                                "id": "art-2",
                                "type": "artworks",
                                "attributes": {
                                    "files": [{"href": "https://resources.tidal.com/images/art-2/640x640.jpg"}]
                                },
                            },
                        ],
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    tracks = asyncio.run(provider.list_tracks("pl-ids"))
    assert len(tracks) == 2
    assert tracks[0].title == "Track One"
    assert tracks[0].artist == "Artist One"
    assert tracks[0].artwork_url == "https://resources.tidal.com/images/art-1/640x640.jpg"
    assert tracks[1].title == "Track Two"
    assert tracks[1].artist == "Artist Two"
    assert tracks[1].artwork_url == "https://resources.tidal.com/images/art-2/640x640.jpg"


def test_add_tracks_omits_position_before_for_empty_playlist(monkeypatch):
    monkeypatch.setattr(settings, "TIDAL_COUNTRY_CODE", "")
    provider = TidalProvider("access-token")
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
            if parsed.path == "/playlists/pl-empty/relationships/items":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/playlists/pl-empty/relationships/items",
                    _empty_playlist_items_payload(),
                )
            raise AssertionError(f"Unexpected request to {url}")

        async def post(self, url: str, headers: dict, params: dict, json: dict):
            captured["add_url"] = url
            captured["add_json"] = json
            request = httpx.Request(
                "POST",
                "https://openapi.tidal.com/v2/playlists/pl-empty/relationships/items",
            )
            return httpx.Response(204, request=request)

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    asyncio.run(provider.add_tracks("pl-empty", ["track-3"]))

    assert captured["add_url"] == "/playlists/pl-empty/relationships/items"
    assert captured["add_json"] == {
        "data": [
            {"id": "track-3", "type": "tracks"},
        ]
    }


def test_add_tracks_omits_invalid_position_before_value(monkeypatch):
    monkeypatch.setattr(settings, "TIDAL_COUNTRY_CODE", "")
    provider = TidalProvider("access-token")
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
            if parsed.path == "/playlists/pl-non-uuid/relationships/items":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/playlists/pl-non-uuid/relationships/items",
                    _playlist_items_with_non_uuid_item_id_payload(),
                )
            raise AssertionError(f"Unexpected request to {url}")

        async def post(self, url: str, headers: dict, params: dict, json: dict):
            captured["add_url"] = url
            captured["add_json"] = json
            request = httpx.Request(
                "POST",
                "https://openapi.tidal.com/v2/playlists/pl-non-uuid/relationships/items",
            )
            return httpx.Response(204, request=request)

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    asyncio.run(provider.add_tracks("pl-non-uuid", ["track-3"]))

    assert captured["add_url"] == "/playlists/pl-non-uuid/relationships/items"
    assert captured["add_json"] == {
        "data": [
            {"id": "track-3", "type": "tracks"},
        ]
    }


def test_search_tracks_and_search_playlists(monkeypatch):
    monkeypatch.setattr(settings, "TIDAL_COUNTRY_CODE", "")
    provider = TidalProvider("access-token")
    search_id = quote("dance", safe="")

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            parsed = urlparse(url)
            if parsed.path == f"/searchResults/{search_id}" and params and params.get("include") == "playlists":
                return _response(
                    "GET",
                    f"https://openapi.tidal.com/v2/searchResults/{search_id}",
                    {
                        "data": [],
                        "included": [
                            {
                                "id": "search-pl-1",
                                "type": "playlists",
                                "attributes": {"name": "Search Playlist", "accessType": "PUBLIC"},
                            }
                        ],
                    },
                )
            if (
                parsed.path == f"/searchResults/{search_id}"
                and params
                and params.get("include") == "tracks,artists,albums,albums.coverArt"
            ):
                return _response(
                    "GET",
                    f"https://openapi.tidal.com/v2/searchResults/{search_id}",
                    {
                        "data": [],
                        "included": [
                            {
                                "id": "search-track-1",
                                "type": "tracks",
                                "attributes": {"title": "Search Track"},
                                "relationships": {"artists": {"data": [{"type": "artists", "id": "artist-1"}]}},
                            },
                            {"id": "artist-1", "type": "artists", "attributes": {"name": "Artist One"}},
                        ],
                    },
                )
            if parsed.path == "/tracks" and params and params.get("filter[id]") == "search-track-1":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/tracks",
                    {
                        "data": [
                            {
                                "id": "search-track-1",
                                "type": "tracks",
                                "attributes": {"title": "Search Track"},
                                "relationships": {
                                    "artists": {"data": [{"type": "artists", "id": "artist-1"}]},
                                    "albums": {"data": [{"type": "albums", "id": "album-1"}]},
                                },
                            }
                        ],
                        "included": [
                            {"id": "artist-1", "type": "artists", "attributes": {"name": "Artist One"}},
                            {
                                "id": "album-1",
                                "type": "albums",
                                "relationships": {"coverArt": {"data": [{"type": "artworks", "id": "art-1"}]}},
                            },
                            {
                                "id": "art-1",
                                "type": "artworks",
                                "attributes": {
                                    "files": [{"href": "https://resources.tidal.com/images/search/640x640.jpg"}]
                                },
                            },
                        ],
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    playlists = asyncio.run(provider.search_playlists("dance", limit=1))
    assert len(playlists) == 1
    assert playlists[0].provider_playlist_id == "search-pl-1"

    tracks = asyncio.run(provider.search_tracks("dance", limit=1))
    assert len(tracks) == 1
    assert tracks[0].provider_track_id == "search-track-1"
    assert tracks[0].artist == "Artist One"


def test_search_tracks_enriches_when_relationship_data_is_missing(monkeypatch):
    monkeypatch.setattr(settings, "TIDAL_COUNTRY_CODE", "")
    provider = TidalProvider("access-token")
    search_id = quote("kasabian", safe="")
    captured: dict[str, int] = {"track_bulk_fetches": 0}

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            parsed = urlparse(url)
            if (
                parsed.path == f"/searchResults/{search_id}"
                and params
                and params.get("include") == "tracks,artists,albums,albums.coverArt"
            ):
                return _response(
                    "GET",
                    f"https://openapi.tidal.com/v2/searchResults/{search_id}",
                    {
                        "data": [],
                        "included": [
                            {
                                "id": "search-track-1",
                                "type": "tracks",
                                "attributes": {"title": "Search Track"},
                                "relationships": {
                                    "artists": {"links": {"self": "/tracks/search-track-1/relationships/artists"}},
                                    "albums": {"links": {"self": "/tracks/search-track-1/relationships/albums"}},
                                },
                            }
                        ],
                    },
                )
            if parsed.path == "/tracks" and params and params.get("filter[id]") == "search-track-1":
                captured["track_bulk_fetches"] += 1
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/tracks",
                    {
                        "data": [
                            {
                                "id": "search-track-1",
                                "type": "tracks",
                                "attributes": {"title": "Search Track"},
                                "relationships": {
                                    "artists": {"data": [{"type": "artists", "id": "artist-1"}]},
                                    "albums": {"data": [{"type": "albums", "id": "album-1"}]},
                                },
                            }
                        ],
                        "included": [
                            {"id": "artist-1", "type": "artists", "attributes": {"name": "Artist One"}},
                            {
                                "id": "album-1",
                                "type": "albums",
                                "relationships": {"coverArt": {"data": [{"type": "artworks", "id": "art-1"}]}},
                            },
                            {
                                "id": "art-1",
                                "type": "artworks",
                                "attributes": {
                                    "files": [{"href": "https://resources.tidal.com/images/search/640x640.jpg"}]
                                },
                            },
                        ],
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    tracks = asyncio.run(provider.search_tracks("kasabian", limit=1))
    assert len(tracks) == 1
    assert tracks[0].provider_track_id == "search-track-1"
    assert tracks[0].artist == "Artist One"
    assert tracks[0].artwork_url == "https://resources.tidal.com/images/search/640x640.jpg"
    assert captured["track_bulk_fetches"] == 1


def test_search_tracks_fast_mode_skips_hydration_calls(monkeypatch):
    monkeypatch.setattr(settings, "TIDAL_COUNTRY_CODE", "")
    provider = TidalProvider("access-token")
    search_id = quote("fast", safe="")
    captured: dict[str, int] = {"track_bulk_fetches": 0, "relationship_fetches": 0}

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            parsed = urlparse(url)
            if (
                parsed.path == f"/searchResults/{search_id}"
                and params
                and params.get("include") == "tracks,artists,albums,albums.coverArt"
            ):
                return _response(
                    "GET",
                    f"https://openapi.tidal.com/v2/searchResults/{search_id}",
                    {
                        "data": [],
                        "included": [
                            {
                                "id": "search-track-1",
                                "type": "tracks",
                                "attributes": {"title": "Fast Track"},
                                "relationships": {
                                    "artists": {"links": {"self": "/tracks/search-track-1/relationships/artists"}},
                                    "albums": {"links": {"self": "/tracks/search-track-1/relationships/albums"}},
                                },
                            }
                        ],
                    },
                )
            if parsed.path == "/tracks":
                captured["track_bulk_fetches"] += 1
                return _response("GET", "https://openapi.tidal.com/v2/tracks", {"data": []})
            if parsed.path == f"/searchResults/{search_id}/relationships/tracks":
                captured["relationship_fetches"] += 1
                return _response(
                    "GET",
                    f"https://openapi.tidal.com/v2/searchResults/{search_id}/relationships/tracks",
                    {"data": []},
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    tracks = asyncio.run(provider.search_tracks("fast", limit=1, hydrate_metadata=False))
    assert len(tracks) == 1
    assert tracks[0].provider_track_id == "search-track-1"
    assert tracks[0].title == "Fast Track"
    assert tracks[0].artist is None
    assert tracks[0].artwork_url is None
    assert captured["track_bulk_fetches"] == 0
    assert captured["relationship_fetches"] == 0


def test_related_tracks_with_offset_and_resolve_track_url(monkeypatch):
    monkeypatch.setattr(settings, "TIDAL_COUNTRY_CODE", "")
    provider = TidalProvider("access-token")

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            parsed = urlparse(url)
            if parsed.path == "/tracks/seed-1/relationships/similarTracks":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/tracks/seed-1/relationships/similarTracks",
                    {
                        "data": [
                            {"id": "rel-1", "type": "tracks"},
                            {"id": "rel-2", "type": "tracks"},
                        ],
                        "included": [
                            {
                                "id": "rel-1",
                                "type": "tracks",
                                "attributes": {"title": "Related One"},
                                "relationships": {"artists": {"data": [{"type": "artists", "id": "artist-a"}]}},
                            },
                            {
                                "id": "rel-2",
                                "type": "tracks",
                                "attributes": {"title": "Related Two"},
                                "relationships": {"artists": {"data": [{"type": "artists", "id": "artist-b"}]}},
                            },
                            {"id": "artist-a", "type": "artists", "attributes": {"name": "Artist A"}},
                            {"id": "artist-b", "type": "artists", "attributes": {"name": "Artist B"}},
                        ],
                        "next": None,
                    },
                )
            if parsed.path == "/tracks" and params and params.get("filter[id]") == "rel-1,rel-2":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/tracks",
                    {
                        "data": [
                            {
                                "id": "rel-1",
                                "type": "tracks",
                                "attributes": {"title": "Related One"},
                                "relationships": {"artists": {"data": [{"type": "artists", "id": "artist-a"}]}},
                            },
                            {
                                "id": "rel-2",
                                "type": "tracks",
                                "attributes": {"title": "Related Two"},
                                "relationships": {"artists": {"data": [{"type": "artists", "id": "artist-b"}]}},
                            },
                        ],
                        "included": [
                            {"id": "artist-a", "type": "artists", "attributes": {"name": "Artist A"}},
                            {"id": "artist-b", "type": "artists", "attributes": {"name": "Artist B"}},
                        ],
                    },
                )
            if parsed.path == "/tracks/t-resolve-1":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/tracks/t-resolve-1",
                    {
                        "data": {
                            "id": "t-resolve-1",
                            "type": "tracks",
                            "attributes": {"title": "Resolved Track"},
                            "relationships": {"artists": {"data": [{"type": "artists", "id": "artist-r"}]}},
                        },
                        "included": [{"id": "artist-r", "type": "artists", "attributes": {"name": "Resolved Artist"}}],
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    related = asyncio.run(provider.related_tracks("seed-1", limit=1, offset=1))
    assert len(related) == 1
    assert related[0].provider_track_id == "rel-2"
    assert related[0].artist == "Artist B"

    resolved = asyncio.run(provider.resolve_track_url("https://listen.tidal.com/track/t-resolve-1"))
    assert resolved.provider_track_id == "t-resolve-1"
    assert resolved.title == "Resolved Track"
    assert resolved.artist == "Resolved Artist"


def test_related_tracks_enriches_when_relationship_data_is_missing(monkeypatch):
    monkeypatch.setattr(settings, "TIDAL_COUNTRY_CODE", "")
    provider = TidalProvider("access-token")
    captured: dict[str, int] = {"track_bulk_fetches": 0}

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str, headers: dict, params: dict | None = None):
            parsed = urlparse(url)
            if parsed.path == "/tracks/seed-2/relationships/similarTracks":
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/tracks/seed-2/relationships/similarTracks",
                    {
                        "data": [
                            {"id": "rel-a", "type": "tracks"},
                            {"id": "rel-b", "type": "tracks"},
                        ],
                        "included": [],
                        "next": None,
                    },
                )
            if parsed.path == "/tracks" and params and params.get("filter[id]") == "rel-a,rel-b":
                captured["track_bulk_fetches"] += 1
                return _response(
                    "GET",
                    "https://openapi.tidal.com/v2/tracks",
                    {
                        "data": [
                            {
                                "id": "rel-a",
                                "type": "tracks",
                                "attributes": {"title": "Related A"},
                                "relationships": {
                                    "artists": {"data": [{"type": "artists", "id": "artist-a"}]},
                                    "albums": {"data": [{"type": "albums", "id": "album-a"}]},
                                },
                            },
                            {
                                "id": "rel-b",
                                "type": "tracks",
                                "attributes": {"title": "Related B"},
                                "relationships": {
                                    "artists": {"data": [{"type": "artists", "id": "artist-b"}]},
                                    "albums": {"data": [{"type": "albums", "id": "album-b"}]},
                                },
                            },
                        ],
                        "included": [
                            {"id": "artist-a", "type": "artists", "attributes": {"name": "Artist A"}},
                            {"id": "artist-b", "type": "artists", "attributes": {"name": "Artist B"}},
                            {
                                "id": "album-a",
                                "type": "albums",
                                "relationships": {"coverArt": {"data": [{"type": "artworks", "id": "art-a"}]}},
                            },
                            {
                                "id": "album-b",
                                "type": "albums",
                                "relationships": {"coverArt": {"data": [{"type": "artworks", "id": "art-b"}]}},
                            },
                            {
                                "id": "art-a",
                                "type": "artworks",
                                "attributes": {
                                    "files": [{"href": "https://resources.tidal.com/images/rel-a/640x640.jpg"}]
                                },
                            },
                            {
                                "id": "art-b",
                                "type": "artworks",
                                "attributes": {
                                    "files": [{"href": "https://resources.tidal.com/images/rel-b/640x640.jpg"}]
                                },
                            },
                        ],
                    },
                )
            raise AssertionError(f"Unexpected request to {url}")

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    related = asyncio.run(provider.related_tracks("seed-2", limit=2, offset=0))
    assert len(related) == 2
    assert related[0].provider_track_id == "rel-a"
    assert related[0].title == "Related A"
    assert related[0].artist == "Artist A"
    assert related[0].artwork_url == "https://resources.tidal.com/images/rel-a/640x640.jpg"
    assert related[1].provider_track_id == "rel-b"
    assert related[1].title == "Related B"
    assert related[1].artist == "Artist B"
    assert related[1].artwork_url == "https://resources.tidal.com/images/rel-b/640x640.jpg"
    assert captured["track_bulk_fetches"] == 1


def test_user_apis_and_auth_error_behavior(monkeypatch):
    monkeypatch.setattr(settings, "TIDAL_COUNTRY_CODE", "")
    provider = TidalProvider("access-token")
    assert asyncio.run(provider.search_users("x")) == []

    with pytest.raises(ProviderAPIError) as exc:
        asyncio.run(provider.get_user("u1"))
    assert exc.value.status_code == 501

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
                "https://openapi.tidal.com/v2/users/me",
                {"errors": [{"title": "Unauthorized"}]},
                status_code=401,
            )

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)
    with pytest.raises(ProviderAuthError):
        asyncio.run(provider.list_playlists())
