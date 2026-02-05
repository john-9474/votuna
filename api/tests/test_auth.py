import pytest
from fastapi.responses import RedirectResponse

from app.config.settings import settings
from app.crud.user import user_crud


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


def test_callback_creates_user_and_sets_cookie(client, db_session, monkeypatch):
    import app.api.v1.routes.auth as auth_routes

    monkeypatch.setattr(auth_routes, "get_sso", lambda provider: DummySSO())
    response = client.get("/api/v1/auth/callback/soundcloud", follow_redirects=False)
    assert response.status_code in {302, 307}
    assert settings.AUTH_COOKIE_NAME in response.headers.get("set-cookie", "")

    user = user_crud.get_by_provider_id(db_session, "soundcloud", "sc-user")
    assert user is not None
    assert user.email == "user@example.com"


def test_logout_clears_cookie(client):
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert settings.AUTH_COOKIE_NAME in response.headers.get("set-cookie", "")
