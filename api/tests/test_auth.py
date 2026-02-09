from fastapi.responses import RedirectResponse

from app.config.settings import settings
from app.crud.user import user_crud
from app.crud.votuna_playlist_invite import votuna_playlist_invite_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud


class DummyOpenID:
    id = "sc-user"
    sub = None
    email = "user@example.com"
    first_name = "Test"
    last_name = "User"
    name = None
    display_name = None
    picture = None
    avatar_url = None
    username = "TestUser"

    def model_dump(self):
        return {
            "id": self.id,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "username": self.username,
        }


class DummySSO:
    access_token = "access"
    refresh_token = "refresh"
    expires_at = None

    async def get_login_redirect(self):
        return RedirectResponse(url="https://example.com/login")

    async def verify_and_process(self, request, **kwargs):
        return DummyOpenID()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None


def test_login_redirect(client, monkeypatch):
    import app.api.v1.routes.auth as auth_routes

    monkeypatch.setattr(auth_routes, "get_sso", lambda provider: DummySSO())
    response = client.get("/api/v1/auth/login/soundcloud", follow_redirects=False)
    assert response.status_code in {302, 307}
    assert response.headers["location"] == "https://example.com/login"


def test_login_redirect_with_invite_context_sets_cookies(client, monkeypatch):
    import app.api.v1.routes.auth as auth_routes

    monkeypatch.setattr(auth_routes, "get_sso", lambda provider: DummySSO())
    response = client.get(
        "/api/v1/auth/login/soundcloud?invite_token=test-token&next=/playlists/123",
        follow_redirects=False,
    )
    assert response.status_code in {302, 307}
    assert response.headers["location"] == "https://example.com/login"
    set_cookie_header = response.headers.get("set-cookie", "")
    assert "votuna_pending_invite_token" in set_cookie_header
    assert "votuna_pending_next" in set_cookie_header


def test_callback_creates_user_and_sets_cookie(client, db_session, monkeypatch):
    import app.api.v1.routes.auth as auth_routes

    monkeypatch.setattr(auth_routes, "get_sso", lambda provider: DummySSO())
    response = client.get("/api/v1/auth/callback/soundcloud", follow_redirects=False)
    assert response.status_code in {302, 307}
    assert settings.AUTH_COOKIE_NAME in response.headers.get("set-cookie", "")

    user = user_crud.get_by_provider_id(db_session, "soundcloud", "sc-user")
    assert user is not None
    assert user.email == "user@example.com"


def test_callback_auto_joins_invite_and_redirects_to_playlist(
    client,
    db_session,
    monkeypatch,
    votuna_playlist,
):
    import app.api.v1.routes.auth as auth_routes

    monkeypatch.setattr(auth_routes, "get_sso", lambda provider: DummySSO())
    invite = votuna_playlist_invite_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "invite_type": "user",
            "token": "pending-token-1",
            "expires_at": None,
            "max_uses": 1,
            "uses_count": 0,
            "is_revoked": False,
            "created_by_user_id": votuna_playlist.owner_user_id,
            "target_auth_provider": "soundcloud",
            "target_provider_user_id": "sc-user",
            "target_username_snapshot": "TestUser",
            "target_user_id": None,
            "accepted_by_user_id": None,
            "accepted_at": None,
        },
    )
    client.cookies.set("votuna_pending_invite_token", invite.token)
    client.cookies.set("votuna_pending_next", f"/playlists/{votuna_playlist.id}")
    response = client.get("/api/v1/auth/callback/soundcloud", follow_redirects=False)
    client.cookies.pop("votuna_pending_invite_token", None)
    client.cookies.pop("votuna_pending_next", None)
    assert response.status_code in {302, 307}
    assert response.headers["location"].endswith(f"/playlists/{votuna_playlist.id}")

    user = user_crud.get_by_provider_id(db_session, "soundcloud", "sc-user")
    assert user is not None
    membership = votuna_playlist_member_crud.get_member(db_session, votuna_playlist.id, user.id)
    assert membership is not None


def test_callback_does_not_auto_accept_targeted_invites_without_invite_context(
    client,
    db_session,
    monkeypatch,
    votuna_playlist,
):
    import app.api.v1.routes.auth as auth_routes

    monkeypatch.setattr(auth_routes, "get_sso", lambda provider: DummySSO())
    invite = votuna_playlist_invite_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "invite_type": "user",
            "token": "pending-token-without-cookie",
            "expires_at": None,
            "max_uses": 1,
            "uses_count": 0,
            "is_revoked": False,
            "created_by_user_id": votuna_playlist.owner_user_id,
            "target_auth_provider": "soundcloud",
            "target_provider_user_id": "sc-user",
            "target_username_snapshot": "TestUser",
            "target_user_id": None,
            "accepted_by_user_id": None,
            "accepted_at": None,
        },
    )
    response = client.get("/api/v1/auth/callback/soundcloud", follow_redirects=False)
    assert response.status_code in {302, 307}
    assert response.headers["location"] == settings.FRONTEND_URL

    user = user_crud.get_by_provider_id(db_session, "soundcloud", "sc-user")
    assert user is not None
    membership = votuna_playlist_member_crud.get_member(db_session, votuna_playlist.id, user.id)
    assert membership is None

    refreshed_invite = votuna_playlist_invite_crud.get(db_session, invite.id)
    assert refreshed_invite is not None
    assert refreshed_invite.accepted_at is None
    assert refreshed_invite.accepted_by_user_id is None
    assert refreshed_invite.uses_count == 0
    assert refreshed_invite.is_revoked is False


def test_logout_clears_cookie(client):
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert settings.AUTH_COOKIE_NAME in response.headers.get("set-cookie", "")
