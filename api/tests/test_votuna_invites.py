from datetime import datetime, timedelta, timezone
import uuid

from app.auth.dependencies import get_current_user
from app.crud.user import user_crud
from app.crud.votuna_playlist_invite import votuna_playlist_invite_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.services.music_providers.base import ProviderUser
from main import app


def _create_targeted_invite(db_session, playlist_id: int, owner_user_id: int, provider_user_id: str):
    return votuna_playlist_invite_crud.create(
        db_session,
        {
            "playlist_id": playlist_id,
            "invite_type": "user",
            "token": f"invite-token-{uuid.uuid4().hex}",
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "max_uses": 1,
            "uses_count": 0,
            "is_revoked": False,
            "created_by_user_id": owner_user_id,
            "target_auth_provider": "soundcloud",
            "target_provider_user_id": provider_user_id,
            "target_username_snapshot": provider_user_id,
            "target_user_id": None,
            "accepted_by_user_id": None,
            "accepted_at": None,
        },
    )


def test_list_invites_owner_returns_active_invites(auth_client, db_session, votuna_playlist, provider_stub):
    provider_stub.users_by_provider_id["provider-user-2"] = ProviderUser(
        provider_user_id="provider-user-2",
        username="jaseline",
        display_name="Jaseline",
        avatar_url="https://img.example/jaseline.jpg",
        profile_url="https://soundcloud.com/jaseline",
    )

    _create_targeted_invite(
        db_session,
        playlist_id=votuna_playlist.id,
        owner_user_id=votuna_playlist.owner_user_id,
        provider_user_id="provider-user-2",
    )
    votuna_playlist_invite_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "invite_type": "link",
            "token": f"invite-token-{uuid.uuid4().hex}",
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "max_uses": 1,
            "uses_count": 0,
            "is_revoked": False,
            "created_by_user_id": votuna_playlist.owner_user_id,
            "target_auth_provider": None,
            "target_provider_user_id": None,
            "target_username_snapshot": None,
            "target_user_id": None,
            "accepted_by_user_id": None,
            "accepted_at": None,
        },
    )

    response = auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert any(invite["invite_type"] == "user" for invite in data)
    assert any(invite["invite_type"] == "link" for invite in data)
    user_invite = next(invite for invite in data if invite["invite_type"] == "user")
    assert user_invite["target_display_name"] == "Jaseline"
    assert user_invite["target_username"] == "jaseline"
    assert user_invite["target_avatar_url"] == "https://img.example/jaseline.jpg"


def test_list_invites_non_owner_forbidden(other_auth_client, votuna_playlist):
    response = other_auth_client.get(f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites")
    assert response.status_code == 403


def test_cancel_invite_owner_success(auth_client, db_session, votuna_playlist):
    invite = _create_targeted_invite(
        db_session,
        playlist_id=votuna_playlist.id,
        owner_user_id=votuna_playlist.owner_user_id,
        provider_user_id="provider-user-2",
    )
    response = auth_client.delete(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites/{invite.id}"
    )
    assert response.status_code == 204
    updated_invite = votuna_playlist_invite_crud.get(db_session, invite.id)
    assert updated_invite is not None
    assert updated_invite.is_revoked is True


def test_cancel_invite_non_owner_forbidden(other_auth_client, db_session, votuna_playlist):
    invite = _create_targeted_invite(
        db_session,
        playlist_id=votuna_playlist.id,
        owner_user_id=votuna_playlist.owner_user_id,
        provider_user_id="provider-user-2",
    )
    response = other_auth_client.delete(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites/{invite.id}"
    )
    assert response.status_code == 403


def test_create_link_invite_owner_defaults(auth_client, votuna_playlist):
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites",
        json={"kind": "link"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["playlist_id"] == votuna_playlist.id
    assert data["invite_type"] == "link"
    assert data["max_uses"] == 1
    assert data["invite_url"].endswith(f"/api/v1/votuna/invites/{data['token']}/open")


def test_create_invite_non_owner_forbidden(other_auth_client, votuna_playlist):
    response = other_auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites",
        json={"kind": "link"},
    )
    assert response.status_code == 403


def test_candidates_local_hit_does_not_call_provider(auth_client, db_session, votuna_playlist, provider_stub):
    target = user_crud.create(
        db_session,
        {
            "auth_provider": "soundcloud",
            "provider_user_id": "alpha-dj",
            "email": "alpha@example.com",
            "first_name": "Alpha",
            "last_name": "DJ",
            "display_name": "Alpha DJ",
            "avatar_url": None,
            "access_token": "token",
            "refresh_token": None,
            "token_expires_at": None,
            "last_login_at": None,
            "is_active": True,
        },
    )
    response = auth_client.get(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites/candidates",
        params={"q": "alpha", "limit": 10},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["source"] == "registered"
    assert data[0]["registered_user_id"] == target.id
    assert provider_stub.search_users_calls == 0


def test_candidates_local_hit_with_at_prefix(auth_client, db_session, votuna_playlist, provider_stub):
    local_handle = f"alpha-{uuid.uuid4().hex[:8]}"
    target = user_crud.create(
        db_session,
        {
            "auth_provider": "soundcloud",
            "provider_user_id": local_handle,
            "email": "alpha-at@example.com",
            "first_name": "Alpha",
            "last_name": "DJ",
            "display_name": "Alpha DJ",
            "avatar_url": None,
            "access_token": "token",
            "refresh_token": None,
            "token_expires_at": None,
            "last_login_at": None,
            "is_active": True,
        },
    )
    response = auth_client.get(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites/candidates",
        params={"q": f"@{local_handle}", "limit": 10},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["registered_user_id"] == target.id
    assert provider_stub.search_users_calls == 0


def test_candidates_provider_fallback_when_local_empty(auth_client, votuna_playlist, provider_stub):
    provider_stub.search_users_results = [
        provider_stub.users_by_provider_id["provider-user-1"],
        provider_stub.users_by_provider_id["provider-user-2"],
    ]
    response = auth_client.get(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites/candidates",
        params={"q": "zxqv-provider-fallback", "limit": 10},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["source"] == "provider"
    assert data[0]["profile_url"].startswith("https://soundcloud.com/")
    assert provider_stub.search_users_calls == 1


def test_create_user_invite_unknown_provider_user_rejects(auth_client, votuna_playlist, provider_stub):
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites",
        json={"kind": "user", "target_provider_user_id": "unknown-provider-id"},
    )
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


def test_create_user_invite_success_unregistered(auth_client, votuna_playlist, provider_stub):
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites",
        json={"kind": "user", "target_provider_user_id": "provider-user-2"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["invite_type"] == "user"
    assert data["target_provider_user_id"] == "provider-user-2"
    assert data["target_user_id"] is None
    assert provider_stub.get_user_calls == 1


def test_create_user_invite_registered_member_conflict(auth_client, db_session, votuna_playlist, provider_stub):
    target_provider_user_id = f"member-{uuid.uuid4().hex}"
    provider_stub.users_by_provider_id[target_provider_user_id] = ProviderUser(
        provider_user_id=target_provider_user_id,
        username=target_provider_user_id,
        display_name="Member User",
        avatar_url=None,
    )

    target = user_crud.create(
        db_session,
        {
            "auth_provider": "soundcloud",
            "provider_user_id": target_provider_user_id,
            "email": "member@example.com",
            "first_name": "Member",
            "last_name": "User",
            "display_name": "Member User",
            "avatar_url": None,
            "access_token": "token",
            "refresh_token": None,
            "token_expires_at": None,
            "last_login_at": None,
            "is_active": True,
        },
    )
    votuna_playlist_member_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "user_id": target.id,
            "role": "member",
        },
    )
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/invites",
        json={"kind": "user", "target_provider_user_id": target_provider_user_id},
    )
    assert response.status_code == 409


def test_join_targeted_invite_mismatch_forbidden(other_auth_client, db_session, votuna_playlist):
    invite = _create_targeted_invite(
        db_session,
        playlist_id=votuna_playlist.id,
        owner_user_id=votuna_playlist.owner_user_id,
        provider_user_id="provider-user-2",
    )
    response = other_auth_client.post(f"/api/v1/votuna/invites/{invite.token}/join")
    assert response.status_code == 403


def test_join_targeted_invite_matching_user_success(client, db_session, votuna_playlist):
    target_provider_user_id = f"join-target-{uuid.uuid4().hex}"
    target_user = user_crud.create(
        db_session,
        {
            "auth_provider": "soundcloud",
            "provider_user_id": target_provider_user_id,
            "email": "target@example.com",
            "first_name": "Target",
            "last_name": "User",
            "display_name": "Target User",
            "avatar_url": None,
            "access_token": "token",
            "refresh_token": None,
            "token_expires_at": None,
            "last_login_at": None,
            "is_active": True,
        },
    )
    app.dependency_overrides[get_current_user] = lambda: target_user
    invite = _create_targeted_invite(
        db_session,
        playlist_id=votuna_playlist.id,
        owner_user_id=votuna_playlist.owner_user_id,
        provider_user_id=target_provider_user_id,
    )
    try:
        response = client.post(f"/api/v1/votuna/invites/{invite.token}/join")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert response.status_code == 200
    membership = votuna_playlist_member_crud.get_member(db_session, votuna_playlist.id, target_user.id)
    assert membership is not None


def test_open_invite_redirects_to_login_when_unauthenticated(client, db_session, votuna_playlist):
    invite = votuna_playlist_invite_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "invite_type": "link",
            "token": f"invite-token-{uuid.uuid4().hex}",
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "max_uses": 1,
            "uses_count": 0,
            "is_revoked": False,
            "created_by_user_id": votuna_playlist.owner_user_id,
        },
    )
    response = client.get(f"/api/v1/votuna/invites/{invite.token}/open", follow_redirects=False)
    assert response.status_code in {302, 307}
    location = response.headers["location"]
    assert "/api/v1/auth/login/soundcloud" in location
    assert "invite_token=" in location


def test_open_invite_authenticated_joins_and_redirects(
    other_auth_client,
    db_session,
    votuna_playlist,
    other_user,
):
    invite = votuna_playlist_invite_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "invite_type": "link",
            "token": f"invite-token-{uuid.uuid4().hex}",
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "max_uses": 1,
            "uses_count": 0,
            "is_revoked": False,
            "created_by_user_id": votuna_playlist.owner_user_id,
        },
    )
    response = other_auth_client.get(f"/api/v1/votuna/invites/{invite.token}/open", follow_redirects=False)
    assert response.status_code in {302, 307}
    assert response.headers["location"].endswith(f"/playlists/{votuna_playlist.id}")
    membership = votuna_playlist_member_crud.get_member(db_session, votuna_playlist.id, other_user.id)
    assert membership is not None
