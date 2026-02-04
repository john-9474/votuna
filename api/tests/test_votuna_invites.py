from datetime import datetime, timedelta, timezone

from app.crud.votuna_playlist_invite import votuna_playlist_invite_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud


def test_create_invite_owner(auth_client, votuna_playlist):
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites",
        json={"expires_in_hours": 2, "max_uses": 5},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["playlist_id"] == votuna_playlist.id
    assert data["token"]


def test_join_with_invite_creates_membership(other_auth_client, db_session, votuna_playlist, other_user):
    invite = votuna_playlist_invite_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "token": "invite-token-1",
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "max_uses": 2,
            "uses_count": 0,
            "is_revoked": False,
            "created_by_user_id": votuna_playlist.owner_user_id,
        },
    )

    response = other_auth_client.post(f"/api/v1/votuna/invites/{invite.token}/join")
    assert response.status_code == 200
    membership = votuna_playlist_member_crud.get_member(db_session, votuna_playlist.id, other_user.id)
    assert membership is not None
    invite_row = votuna_playlist_invite_crud.get_by_token(db_session, invite.token)
    assert invite_row.uses_count == 1


def test_join_with_expired_invite_fails(other_auth_client, db_session, votuna_playlist):
    invite = votuna_playlist_invite_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "token": "invite-token-2",
            "expires_at": datetime.now(timezone.utc) - timedelta(hours=1),
            "max_uses": None,
            "uses_count": 0,
            "is_revoked": False,
            "created_by_user_id": votuna_playlist.owner_user_id,
        },
    )

    response = other_auth_client.post(f"/api/v1/votuna/invites/{invite.token}/join")
    assert response.status_code == 400
