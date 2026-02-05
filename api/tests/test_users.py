import io

from app.crud.user import user_crud


def test_get_me_unauthorized(client):
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_get_me_authorized(auth_client, user):
    response = auth_client.get("/api/v1/users/me")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == user.id


def test_update_me(auth_client, user):
    response = auth_client.patch("/api/v1/users/me", json={"display_name": "Updated"})
    assert response.status_code == 200
    assert response.json()["display_name"] == "Updated"


def test_settings_get_and_update(auth_client):
    response = auth_client.get("/api/v1/users/me/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["theme"] == "system"

    update = auth_client.put("/api/v1/users/me/settings", json={"theme": "dark", "receive_emails": False})
    assert update.status_code == 200
    updated = update.json()
    assert updated["theme"] == "dark"
    assert updated["receive_emails"] is False


def test_avatar_upload_and_fetch(auth_client, user):
    file_bytes = b"\x89PNG\r\n\x1a\n" + b"0" * 10
    files = {"file": ("avatar.png", io.BytesIO(file_bytes), "image/png")}
    response = auth_client.post("/api/v1/users/me/avatar", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["avatar_url"]

    get_response = auth_client.get("/api/v1/users/me/avatar")
    assert get_response.status_code == 200

    get_by_id = auth_client.get(f"/api/v1/users/{user.id}/avatar")
    assert get_by_id.status_code == 200


def test_avatar_redirect_for_remote(auth_client, db_session, user):
    user_crud.update(db_session, user, {"avatar_url": "http://example.com/avatar.png"})
    response = auth_client.get(f"/api/v1/users/{user.id}/avatar", follow_redirects=False)
    assert response.status_code in {302, 307}
    assert response.headers.get("location") == "http://example.com/avatar.png"
