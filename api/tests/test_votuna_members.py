from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_track_suggestion import votuna_track_suggestion_crud


def test_list_members_with_suggested_count(auth_client, db_session, votuna_playlist, user, other_user):
    votuna_playlist_member_crud.create(
        db_session,
        {"playlist_id": votuna_playlist.id, "user_id": other_user.id, "role": "member"},
    )
    votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-a",
            "suggested_by_user_id": user.id,
            "status": "pending",
        },
    )
    votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-b",
            "suggested_by_user_id": user.id,
            "status": "pending",
        },
    )
    votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-c",
            "suggested_by_user_id": other_user.id,
            "status": "pending",
        },
    )

    response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/members")
    assert response.status_code == 200
    data = response.json()
    counts = {member["user_id"]: member["suggested_count"] for member in data}
    profile_urls = {member["user_id"]: member["profile_url"] for member in data}
    assert counts[user.id] == 2
    assert counts[other_user.id] == 1
    assert profile_urls[user.id].startswith("https://soundcloud.com/")
    assert profile_urls[other_user.id].startswith("https://soundcloud.com/")


def test_list_members_non_member_forbidden(other_auth_client, votuna_playlist):
    response = other_auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/members")
    assert response.status_code == 403


def test_owner_can_remove_collaborator(auth_client, db_session, votuna_playlist, other_user):
    membership = votuna_playlist_member_crud.create(
        db_session,
        {"playlist_id": votuna_playlist.id, "user_id": other_user.id, "role": "member"},
    )
    response = auth_client.delete(f"/api/v1/votuna/playlists/{votuna_playlist.id}/members/{other_user.id}")
    assert response.status_code == 204
    removed = votuna_playlist_member_crud.get(db_session, membership.id)
    assert removed is None


def test_owner_remove_owner_rejected(auth_client, votuna_playlist, user):
    response = auth_client.delete(f"/api/v1/votuna/playlists/{votuna_playlist.id}/members/{user.id}")
    assert response.status_code == 400
    assert "owner" in response.json()["detail"].lower()


def test_non_owner_cannot_remove_member(other_auth_client, db_session, votuna_playlist, user):
    response = other_auth_client.delete(f"/api/v1/votuna/playlists/{votuna_playlist.id}/members/{user.id}")
    assert response.status_code == 403


def test_collaborator_can_leave_playlist(other_auth_client, db_session, votuna_playlist, other_user):
    membership = votuna_playlist_member_crud.create(
        db_session,
        {"playlist_id": votuna_playlist.id, "user_id": other_user.id, "role": "member"},
    )
    response = other_auth_client.delete(f"/api/v1/votuna/playlists/{votuna_playlist.id}/members/me")
    assert response.status_code == 204
    removed = votuna_playlist_member_crud.get(db_session, membership.id)
    assert removed is None


def test_owner_cannot_leave_playlist(auth_client, votuna_playlist):
    response = auth_client.delete(f"/api/v1/votuna/playlists/{votuna_playlist.id}/members/me")
    assert response.status_code == 400
    assert "owner" in response.json()["detail"].lower()
