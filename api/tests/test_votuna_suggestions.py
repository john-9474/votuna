from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud
from app.crud.votuna_track_suggestion import votuna_track_suggestion_crud
from app.crud.votuna_track_vote import votuna_track_vote_crud
from app.services.music_providers import ProviderAPIError, ProviderAuthError


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
    assert len(suggestion["voter_display_names"]) == 1
    assert suggestion["voter_display_names"][0]

    list_response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions")
    assert list_response.status_code == 200
    data = list_response.json()
    assert any(item["id"] == suggestion["id"] for item in data)


def test_search_tracks_for_suggestions(auth_client, votuna_playlist, provider_stub):
    response = auth_client.get(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks/search",
        params={"q": "house", "limit": 1},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["provider_track_id"] == "track-search-1"


def test_search_tracks_for_suggestions_whitespace_query_returns_400(
    auth_client,
    votuna_playlist,
    provider_stub,
):
    response = auth_client.get(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks/search",
        params={"q": "   "},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Search query is required"


def test_search_tracks_for_suggestions_provider_auth_owner_returns_401(
    auth_client,
    votuna_playlist,
    provider_stub,
    monkeypatch,
):
    async def _raise_auth_error(self, query: str, limit: int = 10):
        raise ProviderAuthError("expired")

    monkeypatch.setattr(provider_stub, "search_tracks", _raise_auth_error)
    response = auth_client.get(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks/search",
        params={"q": "house"},
    )
    assert response.status_code == 401


def test_search_tracks_for_suggestions_provider_auth_member_returns_409(
    other_auth_client,
    db_session,
    votuna_playlist,
    other_user,
    provider_stub,
    monkeypatch,
):
    votuna_playlist_member_crud.create(
        db_session,
        {"playlist_id": votuna_playlist.id, "user_id": other_user.id, "role": "member"},
    )

    async def _raise_auth_error(self, query: str, limit: int = 10):
        raise ProviderAuthError("expired")

    monkeypatch.setattr(provider_stub, "search_tracks", _raise_auth_error)
    response = other_auth_client.get(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks/search",
        params={"q": "house"},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "Playlist owner must reconnect SoundCloud"


def test_search_tracks_for_suggestions_provider_api_error_returns_502(
    auth_client,
    votuna_playlist,
    provider_stub,
    monkeypatch,
):
    async def _raise_provider_error(self, query: str, limit: int = 10):
        raise ProviderAPIError("provider unavailable")

    monkeypatch.setattr(provider_stub, "search_tracks", _raise_provider_error)
    response = auth_client.get(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks/search",
        params={"q": "house"},
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "provider unavailable"


def test_search_tracks_for_suggestions_requires_member(other_auth_client, votuna_playlist):
    response = other_auth_client.get(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks/search",
        params={"q": "house"},
    )
    assert response.status_code == 403


def test_list_suggestions_with_status_filter(auth_client, db_session, votuna_playlist, user):
    pending = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-pending",
            "track_title": "Pending",
            "suggested_by_user_id": user.id,
            "status": "pending",
        },
    )
    accepted = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-accepted",
            "track_title": "Accepted",
            "suggested_by_user_id": user.id,
            "status": "accepted",
        },
    )

    response = auth_client.get(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        params={"status": "accepted"},
    )
    assert response.status_code == 200
    data = response.json()
    ids = {item["id"] for item in data}
    assert accepted.id in ids
    assert pending.id not in ids
    assert all(item["status"] == "accepted" for item in data)


def test_create_suggestion_from_track_url_resolves_metadata(auth_client, votuna_playlist, provider_stub):
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        json={"track_url": "https://soundcloud.com/test/resolved-track"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["provider_track_id"] == "track-resolved-1"
    assert data["track_title"] == "Resolved Track"
    assert data["track_artist"] == "Resolved Artist"
    assert data["track_url"] == "https://soundcloud.com/test/resolved-track"


def test_create_suggestion_with_track_id_and_url_does_not_resolve_url(
    auth_client,
    votuna_playlist,
    provider_stub,
    monkeypatch,
):
    call_count = {"resolve_track_url": 0}

    async def _track_resolve_calls(self, url: str):
        call_count["resolve_track_url"] += 1
        return self.resolved_track

    monkeypatch.setattr(provider_stub, "resolve_track_url", _track_resolve_calls)
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        json={
            "provider_track_id": "track-direct",
            "track_url": "https://soundcloud.com/test/ignored-for-resolve",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["provider_track_id"] == "track-direct"
    assert data["track_url"] == "https://soundcloud.com/test/ignored-for-resolve"
    assert call_count["resolve_track_url"] == 0


def test_create_suggestion_requires_track_id_or_url(auth_client, votuna_playlist, provider_stub):
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        json={"track_title": "Missing ID"},
    )
    assert response.status_code == 400


def test_create_suggestion_invalid_track_url_returns_400(auth_client, votuna_playlist, provider_stub):
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        json={"track_url": "https://soundcloud.com/test/not-a-track"},
    )
    assert response.status_code == 400


def test_create_suggestion_url_resolve_non_4xx_provider_error_returns_502(
    auth_client,
    votuna_playlist,
    provider_stub,
    monkeypatch,
):
    async def _raise_provider_error(self, url: str):
        raise ProviderAPIError("provider unavailable", status_code=500)

    monkeypatch.setattr(provider_stub, "resolve_track_url", _raise_provider_error)
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        json={"track_url": "https://soundcloud.com/test/server-error-track"},
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "provider unavailable"


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
    assert len(data["voter_display_names"]) == 2


def test_duplicate_suggestion_by_same_user_is_idempotent(
    auth_client,
    db_session,
    votuna_playlist,
    user,
    provider_stub,
):
    suggestion = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-same-user-dup",
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

    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        json={"provider_track_id": "track-same-user-dup"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == suggestion.id
    assert data["vote_count"] == 1
    assert len(data["voter_display_names"]) == 1
    assert votuna_track_vote_crud.count_votes(db_session, suggestion.id) == 1


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


def test_provider_check_error_still_creates_suggestion(
    auth_client,
    votuna_playlist,
    provider_stub,
    monkeypatch,
):
    async def _raise_provider_error(self, provider_playlist_id: str, track_id: str):
        raise ProviderAPIError("provider unavailable")

    monkeypatch.setattr(provider_stub, "track_exists", _raise_provider_error)
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        json={"provider_track_id": "track-api-error"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["provider_track_id"] == "track-api-error"
    assert data["vote_count"] == 1


def test_create_suggestion_auto_add_provider_error_returns_502(
    auth_client,
    db_session,
    votuna_playlist,
    provider_stub,
    monkeypatch,
):
    settings = votuna_playlist_settings_crud.get_by_playlist_id(db_session, votuna_playlist.id)
    votuna_playlist_settings_crud.update(
        db_session,
        settings,
        {"auto_add_on_threshold": True, "required_vote_percent": 60},
    )

    async def _raise_provider_error(self, provider_playlist_id: str, track_ids):
        raise ProviderAPIError("add failed")

    monkeypatch.setattr(provider_stub, "add_tracks", _raise_provider_error)
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        json={"provider_track_id": "track-auto-add-failure-create"},
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "add failed"

    created = votuna_track_suggestion_crud.get_pending_by_track(
        db_session,
        votuna_playlist.id,
        "track-auto-add-failure-create",
    )
    assert created is not None
    assert created.status == "pending"


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


def test_vote_auto_add_provider_error_returns_502(
    other_auth_client,
    db_session,
    votuna_playlist,
    user,
    other_user,
    provider_stub,
    monkeypatch,
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
            "provider_track_id": "track-auto-add-failure-vote",
            "track_title": "Auto Fail Track",
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

    async def _raise_provider_error(self, provider_playlist_id: str, track_ids):
        raise ProviderAPIError("add failed")

    monkeypatch.setattr(provider_stub, "add_tracks", _raise_provider_error)
    response = other_auth_client.post(f"/api/v1/votuna/suggestions/{suggestion.id}/vote")
    assert response.status_code == 502
    assert response.json()["detail"] == "add failed"
    assert votuna_track_vote_crud.count_votes(db_session, suggestion.id) == 2
    db_session.refresh(suggestion)
    assert suggestion.status == "pending"


def test_vote_missing_suggestion_returns_404(auth_client):
    response = auth_client.post("/api/v1/votuna/suggestions/999999/vote")
    assert response.status_code == 404


def test_vote_non_member_forbidden(
    other_auth_client,
    db_session,
    votuna_playlist,
    user,
):
    suggestion = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-non-member-vote",
            "track_title": "Non Member Vote",
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
    assert response.status_code == 403


def test_vote_same_user_twice_is_idempotent(auth_client, votuna_playlist, provider_stub):
    create_response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/suggestions",
        json={"provider_track_id": "track-repeat-vote"},
    )
    assert create_response.status_code == 200
    suggestion_id = create_response.json()["id"]

    vote_response = auth_client.post(f"/api/v1/votuna/suggestions/{suggestion_id}/vote")
    assert vote_response.status_code == 200
    data = vote_response.json()
    assert data["vote_count"] == 1
    assert len(data["voter_display_names"]) == 1


def test_vote_non_pending_does_not_create_vote(
    other_auth_client,
    db_session,
    votuna_playlist,
    user,
    other_user,
):
    votuna_playlist_member_crud.create(
        db_session,
        {"playlist_id": votuna_playlist.id, "user_id": other_user.id, "role": "member"},
    )
    suggestion = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-accepted",
            "track_title": "Already Accepted",
            "suggested_by_user_id": user.id,
            "status": "accepted",
        },
    )
    before = votuna_track_vote_crud.count_votes(db_session, suggestion.id)

    response = other_auth_client.post(f"/api/v1/votuna/suggestions/{suggestion.id}/vote")
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    after = votuna_track_vote_crud.count_votes(db_session, suggestion.id)
    assert after == before
