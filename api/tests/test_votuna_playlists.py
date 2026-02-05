from datetime import datetime, timezone

from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud
from app.crud.votuna_track_suggestion import votuna_track_suggestion_crud


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
    assert data[0]["added_at"] is None
    assert data[0]["suggested_by_display_name"] is None


def test_list_votuna_tracks_includes_suggester(auth_client, db_session, votuna_playlist, user, provider_stub):
    votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-1",
            "track_title": "Test Track",
            "suggested_by_user_id": user.id,
            "status": "accepted",
        },
    )

    response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["provider_track_id"] == "track-1"
    assert data[0]["added_at"] is not None
    assert data[0]["suggested_by_user_id"] == user.id
    assert data[0]["suggested_by_display_name"] == user.display_name


def test_list_votuna_tracks_prefers_latest_accepted_suggestion(
    auth_client,
    db_session,
    votuna_playlist,
    user,
    other_user,
    provider_stub,
):
    older = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-1",
            "track_title": "Older Accepted",
            "suggested_by_user_id": user.id,
            "status": "accepted",
        },
    )
    newer = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-1",
            "track_title": "Newer Accepted",
            "suggested_by_user_id": other_user.id,
            "status": "accepted",
        },
    )

    votuna_track_suggestion_crud.update(
        db_session,
        older,
        {"updated_at": datetime(2024, 1, 1, tzinfo=timezone.utc)},
    )
    votuna_track_suggestion_crud.update(
        db_session,
        newer,
        {"updated_at": datetime(2025, 1, 1, tzinfo=timezone.utc)},
    )

    response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["suggested_by_user_id"] == other_user.id
    assert data[0]["suggested_by_display_name"] == other_user.display_name
    assert data[0]["added_at"].startswith("2025-01-01")


def test_list_votuna_tracks_suggester_name_falls_back_to_first_name(
    auth_client,
    db_session,
    votuna_playlist,
    other_user,
    provider_stub,
):
    other_user.display_name = None
    other_user.first_name = "First Fallback"
    other_user.email = "first-fallback@example.com"
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-1",
            "track_title": "Fallback Track",
            "suggested_by_user_id": other_user.id,
            "status": "accepted",
        },
    )

    response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["suggested_by_display_name"] == "First Fallback"


def test_list_votuna_tracks_suggester_name_falls_back_to_email(
    auth_client,
    db_session,
    votuna_playlist,
    other_user,
    provider_stub,
):
    other_user.display_name = None
    other_user.first_name = None
    other_user.email = "email-fallback@example.com"
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-1",
            "track_title": "Fallback Track",
            "suggested_by_user_id": other_user.id,
            "status": "accepted",
        },
    )

    response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["suggested_by_display_name"] == "email-fallback@example.com"


def test_list_votuna_tracks_suggester_name_falls_back_to_provider_user_id(
    auth_client,
    db_session,
    votuna_playlist,
    other_user,
    provider_stub,
):
    provider_user_id = f"provider-fallback-{other_user.id}"
    other_user.display_name = None
    other_user.first_name = None
    other_user.email = None
    other_user.provider_user_id = provider_user_id
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-1",
            "track_title": "Fallback Track",
            "suggested_by_user_id": other_user.id,
            "status": "accepted",
        },
    )

    response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["suggested_by_display_name"] == provider_user_id
