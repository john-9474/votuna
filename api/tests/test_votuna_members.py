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
    assert counts[user.id] == 2
    assert counts[other_user.id] == 1


def test_list_members_non_member_forbidden(other_auth_client, votuna_playlist):
    response = other_auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/members")
    assert response.status_code == 403
