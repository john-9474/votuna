from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud
from app.crud.votuna_track_suggestion import votuna_track_suggestion_crud
from app.crud.votuna_track_vote import votuna_track_vote_crud


def test_create_and_list_suggestions(auth_client, votuna_playlist, provider_stub):
    payload = {
        "provider_track_id": "track-100",
        "track_title": "Test Track",
        "track_artist": "Artist",
        "track_url": "https://soundcloud.com/test/track-100",
    }
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        json=payload,
    )
    assert response.status_code == 200
    suggestion = response.json()
    assert suggestion["provider_track_id"] == "track-100"
    assert suggestion["vote_count"] == 1

    list_response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions")
    assert list_response.status_code == 200
    data = list_response.json()
    assert any(item["id"] == suggestion["id"] for item in data)


def test_duplicate_suggestion_upvotes_existing(
    other_auth_client,
    db_session,
    votuna_playlist,
    user,
    other_user,
    provider_stub,
):
    suggestion = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-dup",
            "track_title": "Dup Track",
            "suggested_by_user_id": user.id,
            "status": "pending",
        },
    )
    votuna_track_vote_crud.create(
        db_session,
        {
            "suggestion_id": suggestion.id,
            "user_id": user.id,
        },
    )
    votuna_playlist_member_crud.create(
        db_session,
        {"playlist_id": votuna_playlist.id, "user_id": other_user.id, "role": "member"},
    )

    response = other_auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        json={"provider_track_id": "track-dup"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == suggestion.id
    assert data["vote_count"] == 2


def test_track_already_in_provider_returns_conflict(
    auth_client,
    votuna_playlist,
    provider_stub,
    monkeypatch,
):
    monkeypatch.setattr(provider_stub, "track_exists_value", True)
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        json={"provider_track_id": "track-existing"},
    )
    assert response.status_code == 409


def test_vote_auto_add_updates_status(
    other_auth_client,
    db_session,
    votuna_playlist,
    user,
    other_user,
    provider_stub,
):
    settings = votuna_playlist_settings_crud.get_by_playlist_id(db_session, votuna_playlist.id)
    votuna_playlist_settings_crud.update(
        db_session,
        settings,
        {"auto_add_on_threshold": True, "required_vote_percent": 60},
    )
    votuna_playlist_member_crud.create(
        db_session,
        {"playlist_id": votuna_playlist.id, "user_id": other_user.id, "role": "member"},
    )
    suggestion = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-auto",
            "track_title": "Auto Track",
            "suggested_by_user_id": user.id,
            "status": "pending",
        },
    )
    votuna_track_vote_crud.create(
        db_session,
        {
            "suggestion_id": suggestion.id,
            "user_id": user.id,
        },
    )

    response = other_auth_client.post(f"/api/v1/votuna/suggestions/{suggestion.id}/vote")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "accepted"
    assert data["vote_count"] == 2
