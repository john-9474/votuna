from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud


def test_list_votuna_playlists(auth_client, votuna_playlist):
    response = auth_client.get("/api/v1/votuna/playlists")
    assert response.status_code == 200
    data = response.json()
    assert any(item["id"] == votuna_playlist.id for item in data)


def test_get_votuna_playlist_detail(auth_client, votuna_playlist):
    response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == votuna_playlist.id
    assert data["settings"]["required_vote_percent"] == 60


def test_get_votuna_playlist_non_member_forbidden(other_auth_client, votuna_playlist):
    response = other_auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}")
    assert response.status_code == 403


def test_create_votuna_playlist_from_provider(auth_client, provider_stub):
    payload = {"provider": "soundcloud", "provider_playlist_id": "provider-2"}
    response = auth_client.post("/api/v1/votuna/playlists", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["provider_playlist_id"] == "provider-2"
    assert data["title"] == "Synced Playlist"
    assert data["settings"]["auto_add_on_threshold"] is True


def test_create_votuna_playlist_conflict_for_existing_provider_playlist(
    auth_client,
    votuna_playlist,
    provider_stub,
):
    response = auth_client.post(
        "/api/v1/votuna/playlists",
        json={
            "provider": votuna_playlist.provider,
            "provider_playlist_id": votuna_playlist.provider_playlist_id,
        },
    )
    assert response.status_code == 409


def test_create_votuna_playlist_new(auth_client, provider_stub):
    payload = {"provider": "soundcloud", "title": "New Playlist", "description": "Desc", "is_public": True}
    response = auth_client.post("/api/v1/votuna/playlists", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["provider_playlist_id"] == "created-1"
    assert data["title"] == "New Playlist"


def test_create_votuna_playlist_requires_title(auth_client):
    response = auth_client.post("/api/v1/votuna/playlists", json={"provider": "soundcloud"})
    assert response.status_code == 400


def test_update_settings_owner(auth_client, votuna_playlist):
    response = auth_client.patch(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/settings",
        json={"required_vote_percent": 75, "auto_add_on_threshold": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["required_vote_percent"] == 75
    assert data["auto_add_on_threshold"] is False


def test_update_settings_non_owner_forbidden(other_auth_client, votuna_playlist):
    response = other_auth_client.patch(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/settings",
        json={"required_vote_percent": 80},
    )
    assert response.status_code == 403


def test_update_settings_missing_settings_returns_404(auth_client, db_session, votuna_playlist):
    settings = votuna_playlist_settings_crud.get_by_playlist_id(db_session, votuna_playlist.id)
    assert settings is not None
    votuna_playlist_settings_crud.delete(db_session, settings.id)

    response = auth_client.patch(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/settings",
        json={"required_vote_percent": 80},
    )
    assert response.status_code == 404


def test_sync_votuna_playlist(auth_client, votuna_playlist, provider_stub):
    response = auth_client.post(f"/api/v1/votuna/playlists/{votuna_playlist.id}/sync")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Synced Playlist"


def test_list_votuna_tracks(auth_client, votuna_playlist, provider_stub):
    response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["provider_track_id"] == "track-1"
