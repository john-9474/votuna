def test_root(client):
    """Ensure the root endpoint returns the welcome payload."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Votuna API"}


def test_health(client):
    """Ensure the health endpoint reports a connected database."""
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["database"] == "connected"
