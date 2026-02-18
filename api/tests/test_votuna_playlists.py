from datetime import datetime, timezone
import uuid

from app.crud.votuna_playlist_invite import votuna_playlist_invite_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud
from app.crud.votuna_track_addition import votuna_track_addition_crud
from app.crud.votuna_track_suggestion import votuna_track_suggestion_crud
from app.services.music_providers import ProviderAPIError


def _set_personal_mode(db_session, playlist) -> None:
    for membership, _user in votuna_playlist_member_crud.list_members(db_session, playlist.id):
        if membership.user_id == playlist.owner_user_id:
            continue
        db_session.delete(membership)
    db_session.commit()


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
    assert data["settings"]["tie_break_mode"] == "add"


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
    assert data["settings"]["required_vote_percent"] == 60
    assert data["settings"]["tie_break_mode"] == "add"


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
        json={"required_vote_percent": 75, "tie_break_mode": "reject"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["required_vote_percent"] == 75
    assert data["tie_break_mode"] == "reject"


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
    assert data[0]["added_source"] == "outside_votuna"
    assert data[0]["added_by_label"] == "Added outside Votuna"
    assert data[0]["suggested_by_display_name"] is None


def test_remove_track_owner_success(auth_client, votuna_playlist, provider_stub):
    provider_stub.tracks_by_playlist_id[votuna_playlist.provider_playlist_id] = [
        provider_stub.tracks[0],
        provider_stub.tracks[1],
    ]
    response = auth_client.delete(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks/{provider_stub.tracks[0].provider_track_id}"
    )
    assert response.status_code == 204

    tracks_response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks")
    assert tracks_response.status_code == 200
    track_ids = [track["provider_track_id"] for track in tracks_response.json()]
    assert provider_stub.tracks[0].provider_track_id not in track_ids
    assert provider_stub.tracks[1].provider_track_id in track_ids


def test_remove_track_non_owner_forbidden(other_auth_client, votuna_playlist, provider_stub):
    response = other_auth_client.delete(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks/{provider_stub.tracks[0].provider_track_id}"
    )
    assert response.status_code == 403


def test_remove_track_unsupported_provider_returns_405(
    auth_client,
    db_session,
    votuna_playlist,
    provider_stub,
    monkeypatch,
):
    votuna_playlist.provider = "apple"
    db_session.add(votuna_playlist)
    db_session.commit()

    async def _raise_not_supported(self, provider_playlist_id: str, track_ids):
        raise ProviderAPIError(
            "Apple Music track removal is not supported for library playlists",
            status_code=501,
        )

    monkeypatch.setattr(provider_stub, "remove_tracks", _raise_not_supported)
    response = auth_client.delete(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks/{provider_stub.tracks[0].provider_track_id}"
    )
    assert response.status_code == 405
    assert "not supported" in response.json()["detail"].lower()


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
    assert data[0]["added_source"] == "votuna_suggestion"
    assert data[0]["added_by_label"] == "Suggested by You"
    assert data[0]["suggested_by_user_id"] == user.id
    assert data[0]["suggested_by_display_name"] == "You"


def test_list_votuna_tracks_uses_playlist_utils_provenance(
    auth_client, db_session, votuna_playlist, user, provider_stub
):
    votuna_track_addition_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-1",
            "source": "playlist_utils",
            "added_at": datetime(2025, 2, 2, tzinfo=timezone.utc),
            "added_by_user_id": user.id,
            "suggestion_id": None,
        },
    )

    response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["added_source"] == "playlist_utils"
    assert data[0]["added_by_label"] == "Added by playlist utils"
    assert data[0]["added_at"].startswith("2025-02-02")


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


def test_add_track_direct_personal_mode_success(auth_client, db_session, votuna_playlist, user, provider_stub):
    _set_personal_mode(db_session, votuna_playlist)

    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks",
        json={
            "provider_track_id": "track-1",
            "track_title": "Direct Track",
            "track_artist": "Direct Artist",
            "track_url": "https://soundcloud.com/test/track-1",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["added_source"] == "personal_add"
    assert data["added_by_label"] == "Added directly by You"

    tracks_response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks")
    assert tracks_response.status_code == 200
    tracks = tracks_response.json()
    assert tracks[0]["added_source"] == "personal_add"
    assert tracks[0]["added_by_label"] == "Added directly by You"
    assert tracks[0]["added_at"] is not None


def test_add_track_direct_non_owner_forbidden(other_auth_client, db_session, votuna_playlist):
    _set_personal_mode(db_session, votuna_playlist)
    response = other_auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks",
        json={"provider_track_id": "track-1"},
    )
    assert response.status_code == 403


def test_add_track_direct_collaborative_mode_conflict(auth_client, votuna_playlist):
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks",
        json={"provider_track_id": "track-1"},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "COLLABORATIVE_PLAYLIST_DIRECT_ADD_DISABLED"


def test_add_track_direct_duplicate_conflict(auth_client, db_session, votuna_playlist, provider_stub, monkeypatch):
    _set_personal_mode(db_session, votuna_playlist)
    monkeypatch.setattr(provider_stub, "track_exists_value", True)
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks",
        json={"provider_track_id": "track-1"},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "Track already exists in playlist"


def test_add_track_direct_from_url_resolves(auth_client, db_session, votuna_playlist, provider_stub):
    _set_personal_mode(db_session, votuna_playlist)
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/tracks",
        json={"track_url": "https://soundcloud.com/test/resolved-track"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["provider_track_id"] == "track-resolved-1"
    assert data["added_source"] == "personal_add"


def test_personalize_playlist_owner_success(
    auth_client,
    db_session,
    votuna_playlist,
    user,
):
    collaborator_count = sum(
        1
        for membership, _ in votuna_playlist_member_crud.list_members(db_session, votuna_playlist.id)
        if membership.user_id != votuna_playlist.owner_user_id
    )
    assert collaborator_count > 0

    invite = votuna_playlist_invite_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "invite_type": "link",
            "token": f"personalize-{uuid.uuid4().hex}",
            "uses_count": 0,
            "is_revoked": False,
            "accepted_at": None,
            "created_by_user_id": user.id,
        },
    )
    suggestion = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-personalize-pending",
            "track_title": "Pending",
            "suggested_by_user_id": user.id,
            "status": "pending",
        },
    )

    response = auth_client.post(f"/api/v1/votuna/playlists/{votuna_playlist.id}/personalize")
    assert response.status_code == 200
    data = response.json()
    assert data["playlist_type"] == "personal"
    assert data["removed_collaborators"] == collaborator_count
    assert data["revoked_invites"] == 1
    assert data["canceled_suggestions"] == 1

    updated_invite = votuna_playlist_invite_crud.get(db_session, invite.id)
    assert updated_invite is not None
    assert updated_invite.is_revoked is True

    updated_suggestion = votuna_track_suggestion_crud.get(db_session, suggestion.id)
    assert updated_suggestion is not None
    assert updated_suggestion.status == "canceled"
    assert updated_suggestion.resolution_reason == "canceled_by_owner"


def test_personalize_playlist_non_owner_forbidden(other_auth_client, votuna_playlist):
    response = other_auth_client.post(f"/api/v1/votuna/playlists/{votuna_playlist.id}/personalize")
    assert response.status_code == 403


def test_personalize_playlist_idempotent(auth_client, db_session, votuna_playlist):
    _set_personal_mode(db_session, votuna_playlist)
    response = auth_client.post(f"/api/v1/votuna/playlists/{votuna_playlist.id}/personalize")
    assert response.status_code == 200
    data = response.json()
    assert data["removed_collaborators"] == 0
    assert data["revoked_invites"] == 0
    assert data["canceled_suggestions"] == 0


def test_update_settings_personal_mode_conflict(auth_client, db_session, votuna_playlist):
    _set_personal_mode(db_session, votuna_playlist)
    response = auth_client.patch(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/settings",
        json={"required_vote_percent": 75},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "PERSONAL_PLAYLIST_SETTINGS_DISABLED"
