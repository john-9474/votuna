import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://user:pass@localhost:5432/test_db",
)
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret")
os.environ.setdefault("USER_FILES_DIR", "user_files_test")

from app.db.session import Base, get_db
import app.models  # noqa: F401
from main import app
from app.auth.dependencies import get_current_user
from app.crud.user import user_crud
from app.crud.votuna_playlist import votuna_playlist_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud
from app.services.music_providers.base import ProviderPlaylist, ProviderTrack


class DummyProvider:
    provider = "soundcloud"
    playlists = [
        ProviderPlaylist(
            provider="soundcloud",
            provider_playlist_id="provider-1",
            title="Provider Playlist",
            description="Test playlist",
            track_count=2,
            is_public=True,
        )
    ]
    tracks = [
        ProviderTrack(
            provider_track_id="track-1",
            title="Test Track",
            artist="Artist",
            artwork_url=None,
            url="https://soundcloud.com/test/track-1",
        )
    ]
    track_exists_value = False

    def __init__(self, access_token: str):
        self.access_token = access_token

    async def list_playlists(self):
        return self.playlists

    async def get_playlist(self, provider_playlist_id: str):
        return ProviderPlaylist(
            provider=self.provider,
            provider_playlist_id=provider_playlist_id,
            title="Synced Playlist",
            description="Synced description",
            track_count=3,
            is_public=False,
        )

    async def create_playlist(self, title: str, description: str | None = None, is_public: bool | None = None):
        return ProviderPlaylist(
            provider=self.provider,
            provider_playlist_id="created-1",
            title=title,
            description=description,
            track_count=0,
            is_public=is_public,
        )

    async def list_tracks(self, provider_playlist_id: str):
        return self.tracks

    async def add_tracks(self, provider_playlist_id: str, track_ids):
        return None

    async def track_exists(self, provider_playlist_id: str, track_id: str) -> bool:
        return self.track_exists_value

TEST_DATABASE_URL = "sqlite+pysqlite://"


def _create_test_engine():
    """Create an in-memory SQLite engine for tests."""
    return create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


@pytest.fixture(scope="session")
def test_engine():
    """Provide a session-scoped SQLAlchemy engine with tables created."""
    engine = _create_test_engine()
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture()
def db_session(test_engine):
    """Provide a database session bound to the test engine."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    """Provide a TestClient with the DB dependency overridden."""
    def _override_get_db():
        """Yield the test session for dependency overrides."""
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _create_user(db_session, **overrides):
    """Create a test user with sensible defaults."""
    data = {
        "auth_provider": "soundcloud",
        "provider_user_id": overrides.pop("provider_user_id", "test-user"),
        "email": overrides.pop("email", "user@example.com"),
        "first_name": overrides.pop("first_name", "Test"),
        "last_name": overrides.pop("last_name", "User"),
        "display_name": overrides.pop("display_name", "Test User"),
        "avatar_url": overrides.pop("avatar_url", None),
        "access_token": overrides.pop("access_token", "token"),
        "refresh_token": overrides.pop("refresh_token", None),
        "token_expires_at": overrides.pop("token_expires_at", None),
        "last_login_at": overrides.pop("last_login_at", None),
        "is_active": overrides.pop("is_active", True),
    }
    data.update(overrides)
    return user_crud.create(db_session, data)


@pytest.fixture()
def user(db_session):
    suffix = uuid.uuid4().hex
    return _create_user(
        db_session,
        provider_user_id=f"test-user-{suffix}",
        email=f"user-{suffix}@example.com",
    )


@pytest.fixture()
def other_user(db_session):
    suffix = uuid.uuid4().hex
    return _create_user(
        db_session,
        provider_user_id=f"test-user-{suffix}",
        email=f"user-{suffix}@example.com",
    )


@pytest.fixture()
def auth_client(client, user):
    app.dependency_overrides[get_current_user] = lambda: user
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture()
def other_auth_client(client, other_user):
    app.dependency_overrides[get_current_user] = lambda: other_user
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture()
def votuna_playlist(db_session, user):
    provider_playlist_id = f"pl-{uuid.uuid4().hex}"
    playlist = votuna_playlist_crud.create(
        db_session,
        {
            "owner_user_id": user.id,
            "provider": "soundcloud",
            "provider_playlist_id": provider_playlist_id,
            "title": "Test Playlist",
            "description": "Test",
            "image_url": None,
            "is_active": True,
        },
    )
    votuna_playlist_settings_crud.create(
        db_session,
        {
            "playlist_id": playlist.id,
            "required_vote_percent": 60,
            "auto_add_on_threshold": False,
        },
    )
    votuna_playlist_member_crud.create(
        db_session,
        {
            "playlist_id": playlist.id,
            "user_id": user.id,
            "role": "owner",
        },
    )
    return playlist


@pytest.fixture()
def provider_stub(monkeypatch):
    from app.api.v1.routes import playlists as playlists_routes
    from app.api.v1.routes.votuna import common as votuna_common

    def _factory(provider: str, access_token: str):
        return DummyProvider(access_token)

    monkeypatch.setattr(playlists_routes, "get_music_provider", _factory)
    monkeypatch.setattr(votuna_common, "get_music_provider", _factory)
    return DummyProvider
