from app.auth.dependencies import AUTH_EXPIRED_HEADER
from app.crud.user import user_crud
from app.services.music_providers.base import ProviderAuthError


def test_list_provider_playlists(auth_client, provider_stub):
    response = auth_client.get("/api/v1/playlists/providers/soundcloud")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert data[0]["provider"] == "soundcloud"


def test_create_provider_playlist(auth_client, provider_stub):
    response = auth_client.post(
        "/api/v1/playlists/providers/soundcloud",
        json={"title": "New Playlist", "description": "Desc", "is_public": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["provider_playlist_id"] == "created-1"
    assert data["title"] == "New Playlist"


def test_search_provider_playlists(auth_client, provider_stub):
    response = auth_client.get("/api/v1/playlists/providers/soundcloud/search?q=search&limit=2")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    assert data[0]["provider_playlist_id"] == "search-1"


def test_resolve_provider_playlist(auth_client, provider_stub):
    response = auth_client.get(
        "/api/v1/playlists/providers/soundcloud/resolve?url=https://soundcloud.com/test/sets/my-playlist"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["provider_playlist_id"] == "resolved-playlist-1"
    assert data["title"] == "Resolved Playlist"


def test_resolve_provider_playlist_invalid_url_returns_400(auth_client, provider_stub):
    response = auth_client.get(
        "/api/v1/playlists/providers/soundcloud/resolve?url=https://soundcloud.com/not-a-playlist"
    )
    assert response.status_code == 400


def test_missing_access_token_returns_400(auth_client, db_session, user):
    user_crud.update(db_session, user, {"access_token": None})
    response = auth_client.get("/api/v1/playlists/providers/soundcloud")
    assert response.status_code == 400


def test_provider_auth_401_does_not_set_auth_expired_header(auth_client, provider_stub, monkeypatch):
    async def _raise_provider_auth(*args, **kwargs):
        raise ProviderAuthError("SoundCloud authorization expired or invalid")

    monkeypatch.setattr(provider_stub, "list_playlists", _raise_provider_auth)
    response = auth_client.get("/api/v1/playlists/providers/soundcloud")
    assert response.status_code == 401
    assert response.headers.get(AUTH_EXPIRED_HEADER) is None
