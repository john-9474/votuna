import os
import uuid
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://user:pass@localhost:5432/test_db",
)
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-32-characters-long")
os.environ.setdefault("USER_FILES_DIR", "user_files_test")

from app.db.session import Base, get_db
import app.models  # noqa: F401
from main import app
from app.auth.dependencies import get_current_user, get_optional_current_user
from app.crud.user import user_crud
from app.crud.votuna_playlist import votuna_playlist_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud
from app.services.music_providers.base import (
    ProviderAPIError,
    ProviderPlaylist,
    ProviderTrack,
    ProviderUser,
)


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
            genre="House",
            artwork_url=None,
            url="https://soundcloud.com/test/track-1",
        ),
        ProviderTrack(
            provider_track_id="track-2",
            title="Test Track Two",
            artist="Artist Two",
            genre="UKG",
            artwork_url=None,
            url="https://soundcloud.com/test/track-2",
        ),
    ]
    tracks_by_playlist_id = {
        "provider-1": [tracks[0]],
        "provider-2": [tracks[0], tracks[1]],
    }
    search_tracks_results = [
        ProviderTrack(
            provider_track_id="track-search-1",
            title="Search Result One",
            artist="Artist One",
            genre="House",
            artwork_url=None,
            url="https://soundcloud.com/test/search-result-one",
        ),
        ProviderTrack(
            provider_track_id="track-search-2",
            title="Search Result Two",
            artist="Artist Two",
            genre="Techno",
            artwork_url=None,
            url="https://soundcloud.com/test/search-result-two",
        ),
    ]
    resolved_track = ProviderTrack(
        provider_track_id="track-resolved-1",
        title="Resolved Track",
        artist="Resolved Artist",
        genre="House",
        artwork_url=None,
        url="https://soundcloud.com/test/resolved-track",
    )
    track_exists_value = False
    search_playlists_results = [
        ProviderPlaylist(
            provider="soundcloud",
            provider_playlist_id="search-1",
            title="Search Playlist One",
            description="Search result",
            track_count=5,
            is_public=True,
        ),
        ProviderPlaylist(
            provider="soundcloud",
            provider_playlist_id="search-2",
            title="Search Playlist Two",
            description="Search result",
            track_count=7,
            is_public=True,
        ),
    ]
    resolved_playlist = ProviderPlaylist(
        provider="soundcloud",
        provider_playlist_id="resolved-playlist-1",
        title="Resolved Playlist",
        description="Resolved from URL",
        track_count=3,
        is_public=True,
    )
    users_by_provider_id = {
        "provider-user-1": ProviderUser(
            provider_user_id="provider-user-1",
            username="provider-user-1",
            display_name="Provider User One",
            avatar_url=None,
            profile_url="https://soundcloud.com/provider-user-1",
        ),
    }
    search_users_results = [
        ProviderUser(
            provider_user_id="provider-user-1",
            username="provider-user-1",
            display_name="Provider User One",
            avatar_url=None,
            profile_url="https://soundcloud.com/provider-user-1",
        ),
    ]
    search_users_calls = 0
    get_user_calls = 0
    add_tracks_calls: list[dict] = []
    fail_add_chunk_for_track_ids: set[str] = set()
    fail_add_single_for_track_ids: set[str] = set()
    related_tracks_by_seed = {
        "track-1": [
            ProviderTrack(
                provider_track_id="track-related-1",
                title="Related One",
                artist="Related Artist One",
                genre="House",
                artwork_url=None,
                url="https://soundcloud.com/test/related-one",
            ),
            ProviderTrack(
                provider_track_id="track-related-2",
                title="Related Two",
                artist="Related Artist Two",
                genre="Techno",
                artwork_url=None,
                url="https://soundcloud.com/test/related-two",
            ),
            ProviderTrack(
                provider_track_id="track-2",
                title="Test Track Two",
                artist="Artist Two",
                genre="UKG",
                artwork_url=None,
                url="https://soundcloud.com/test/track-2",
            ),
        ],
        "track-2": [
            ProviderTrack(
                provider_track_id="track-related-2",
                title="Related Two",
                artist="Related Artist Two",
                genre="Techno",
                artwork_url=None,
                url="https://soundcloud.com/test/related-two",
            ),
            ProviderTrack(
                provider_track_id="track-related-3",
                title="Related Three",
                artist="Related Artist Three",
                genre="Garage",
                artwork_url=None,
                url="https://soundcloud.com/test/related-three",
            ),
            ProviderTrack(
                provider_track_id="track-related-4",
                title="Related Four",
                artist="Related Artist Four",
                genre="Bass",
                artwork_url=None,
                url="https://soundcloud.com/test/related-four",
            ),
            ProviderTrack(
                provider_track_id="track-related-5",
                title="Related Five",
                artist="Related Artist Five",
                genre="House",
                artwork_url=None,
                url="https://soundcloud.com/test/related-five",
            ),
            ProviderTrack(
                provider_track_id="track-related-6",
                title="Related Six",
                artist="Related Artist Six",
                genre="House",
                artwork_url=None,
                url="https://soundcloud.com/test/related-six",
            ),
        ],
    }
    related_tracks_calls: list[dict] = []
    fail_related_status_code: int | None = None

    def __init__(self, access_token: str):
        self.access_token = access_token

    async def list_playlists(self):
        return self.playlists

    async def get_playlist(self, provider_playlist_id: str):
        title_map = {
            "provider-1": "Provider Playlist",
            "provider-2": "Synced Playlist",
            "source-1": "Source Playlist",
            "dest-1": "Destination Playlist",
            "export-dest-1": "Export Destination",
        }
        track_count = len(self.tracks_by_playlist_id.get(provider_playlist_id, self.tracks))
        return ProviderPlaylist(
            provider=self.provider,
            provider_playlist_id=provider_playlist_id,
            title=title_map.get(provider_playlist_id, "Synced Playlist"),
            description="Synced description",
            track_count=track_count,
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
        return self.tracks_by_playlist_id.get(provider_playlist_id, self.tracks)

    async def search_tracks(self, query: str, limit: int = 10):
        if not query.strip():
            return []
        return self.search_tracks_results[:limit]

    async def related_tracks(self, provider_track_id: str, limit: int = 25, offset: int = 0):
        if self.fail_related_status_code is not None:
            raise ProviderAPIError(
                "provider unavailable",
                status_code=self.fail_related_status_code,
            )
        seed_id = str(provider_track_id).strip()
        self.related_tracks_calls.append(
            {
                "provider_track_id": seed_id,
                "limit": limit,
                "offset": offset,
            }
        )
        tracks = self.related_tracks_by_seed.get(seed_id, [])
        safe_offset = max(0, int(offset))
        safe_limit = max(1, int(limit))
        return tracks[safe_offset : safe_offset + safe_limit]

    async def search_playlists(self, query: str, limit: int = 10):
        if not query.strip():
            return []
        return self.search_playlists_results[:limit]

    async def resolve_playlist_url(self, url: str):
        if "not-a-playlist" in url:
            raise ProviderAPIError("Resolved URL is not a playlist", status_code=400)
        if "missing-playlist" in url:
            raise ProviderAPIError("Unable to resolve playlist URL", status_code=404)
        return self.resolved_playlist

    async def resolve_track_url(self, url: str):
        if "not-a-track" in url:
            from app.services.music_providers.base import ProviderAPIError

            raise ProviderAPIError("Resolved URL is not a track", status_code=400)
        return self.resolved_track

    async def search_users(self, query: str, limit: int = 10):
        type(self).search_users_calls += 1
        if not query.strip():
            return []
        return self.search_users_results[:limit]

    async def get_user(self, provider_user_id: str):
        type(self).get_user_calls += 1
        user = self.users_by_provider_id.get(provider_user_id)
        if not user:
            raise ProviderAPIError("Provider user not found", status_code=404)
        return user

    async def add_tracks(self, provider_playlist_id: str, track_ids):
        normalized_ids = [str(track_id) for track_id in track_ids]
        self.add_tracks_calls.append({"provider_playlist_id": provider_playlist_id, "track_ids": normalized_ids})
        if len(normalized_ids) > 1 and any(
            track_id in self.fail_add_chunk_for_track_ids for track_id in normalized_ids
        ):
            raise ProviderAPIError("chunk add failed")
        if len(normalized_ids) == 1 and normalized_ids[0] in self.fail_add_single_for_track_ids:
            raise ProviderAPIError("single add failed")

        playlist_tracks = self.tracks_by_playlist_id.setdefault(provider_playlist_id, [])
        existing_ids = {track.provider_track_id for track in playlist_tracks}
        track_catalog = {track.provider_track_id: track for track in self.tracks}

        for track_id in normalized_ids:
            if track_id in existing_ids:
                continue
            template = track_catalog.get(
                track_id,
                ProviderTrack(
                    provider_track_id=track_id,
                    title=f"Track {track_id}",
                    artist=None,
                    genre=None,
                    artwork_url=None,
                    url=None,
                ),
            )
            playlist_tracks.append(
                ProviderTrack(
                    provider_track_id=template.provider_track_id,
                    title=template.title,
                    artist=template.artist,
                    genre=template.genre,
                    artwork_url=template.artwork_url,
                    url=template.url,
                )
            )
            existing_ids.add(track_id)
        return None

    async def remove_tracks(self, provider_playlist_id: str, track_ids):
        normalized_remove_ids = {str(track_id) for track_id in track_ids}
        playlist_tracks = self.tracks_by_playlist_id.setdefault(provider_playlist_id, [])
        self.tracks_by_playlist_id[provider_playlist_id] = [
            track for track in playlist_tracks if str(track.provider_track_id) not in normalized_remove_ids
        ]
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
        "permalink_url": overrides.pop("permalink_url", None),
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
    app.dependency_overrides[get_optional_current_user] = lambda: user
    yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_optional_current_user, None)


@pytest.fixture()
def other_auth_client(client, other_user):
    app.dependency_overrides[get_current_user] = lambda: other_user
    app.dependency_overrides[get_optional_current_user] = lambda: other_user
    yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_optional_current_user, None)


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
            "tie_break_mode": "add",
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
    default_member = _create_user(
        db_session,
        provider_user_id=f"default-member-{uuid.uuid4().hex}",
        email=f"default-member-{uuid.uuid4().hex}@example.com",
    )
    votuna_playlist_member_crud.create(
        db_session,
        {
            "playlist_id": playlist.id,
            "user_id": default_member.id,
            "role": "member",
        },
    )
    return playlist


@pytest.fixture()
def provider_stub(monkeypatch):
    from app.services.music_providers import session as provider_session

    DummyProvider.playlists = [
        ProviderPlaylist(
            provider="soundcloud",
            provider_playlist_id="provider-1",
            title="Provider Playlist",
            description="Test playlist",
            track_count=2,
            is_public=True,
        )
    ]
    DummyProvider.tracks = [
        ProviderTrack(
            provider_track_id="track-1",
            title="Test Track",
            artist="Artist",
            genre="House",
            artwork_url=None,
            url="https://soundcloud.com/test/track-1",
        ),
        ProviderTrack(
            provider_track_id="track-2",
            title="Test Track Two",
            artist="Artist Two",
            genre="UKG",
            artwork_url=None,
            url="https://soundcloud.com/test/track-2",
        ),
    ]
    DummyProvider.tracks_by_playlist_id = {
        "provider-1": deepcopy(DummyProvider.tracks[:1]),
        "provider-2": deepcopy(DummyProvider.tracks),
        "source-1": deepcopy(DummyProvider.tracks),
        "dest-1": deepcopy(DummyProvider.tracks[:1]),
    }
    DummyProvider.search_tracks_results = [
        ProviderTrack(
            provider_track_id="track-search-1",
            title="Search Result One",
            artist="Artist One",
            genre="House",
            artwork_url=None,
            url="https://soundcloud.com/test/search-result-one",
        ),
        ProviderTrack(
            provider_track_id="track-search-2",
            title="Search Result Two",
            artist="Artist Two",
            genre="Techno",
            artwork_url=None,
            url="https://soundcloud.com/test/search-result-two",
        ),
    ]
    DummyProvider.resolved_track = ProviderTrack(
        provider_track_id="track-resolved-1",
        title="Resolved Track",
        artist="Resolved Artist",
        genre="House",
        artwork_url=None,
        url="https://soundcloud.com/test/resolved-track",
    )
    DummyProvider.track_exists_value = False
    DummyProvider.search_playlists_results = [
        ProviderPlaylist(
            provider="soundcloud",
            provider_playlist_id="search-1",
            title="Search Playlist One",
            description="Search result",
            track_count=5,
            is_public=True,
        ),
        ProviderPlaylist(
            provider="soundcloud",
            provider_playlist_id="search-2",
            title="Search Playlist Two",
            description="Search result",
            track_count=7,
            is_public=True,
        ),
    ]
    DummyProvider.resolved_playlist = ProviderPlaylist(
        provider="soundcloud",
        provider_playlist_id="resolved-playlist-1",
        title="Resolved Playlist",
        description="Resolved from URL",
        track_count=3,
        is_public=True,
    )
    DummyProvider.users_by_provider_id = {
        "provider-user-1": ProviderUser(
            provider_user_id="provider-user-1",
            username="provider-user-1",
            display_name="Provider User One",
            avatar_url=None,
            profile_url="https://soundcloud.com/provider-user-1",
        ),
        "provider-user-2": ProviderUser(
            provider_user_id="provider-user-2",
            username="provider-user-2",
            display_name="Provider User Two",
            avatar_url=None,
            profile_url="https://soundcloud.com/provider-user-2",
        ),
    }
    DummyProvider.search_users_results = [
        ProviderUser(
            provider_user_id="provider-user-1",
            username="provider-user-1",
            display_name="Provider User One",
            avatar_url=None,
            profile_url="https://soundcloud.com/provider-user-1",
        ),
        ProviderUser(
            provider_user_id="provider-user-2",
            username="provider-user-2",
            display_name="Provider User Two",
            avatar_url=None,
            profile_url="https://soundcloud.com/provider-user-2",
        ),
    ]
    DummyProvider.search_users_calls = 0
    DummyProvider.get_user_calls = 0
    DummyProvider.add_tracks_calls = []
    DummyProvider.fail_add_chunk_for_track_ids = set()
    DummyProvider.fail_add_single_for_track_ids = set()
    DummyProvider.related_tracks_by_seed = {
        "track-1": [
            ProviderTrack(
                provider_track_id="track-related-1",
                title="Related One",
                artist="Related Artist One",
                genre="House",
                artwork_url=None,
                url="https://soundcloud.com/test/related-one",
            ),
            ProviderTrack(
                provider_track_id="track-related-2",
                title="Related Two",
                artist="Related Artist Two",
                genre="Techno",
                artwork_url=None,
                url="https://soundcloud.com/test/related-two",
            ),
            ProviderTrack(
                provider_track_id="track-2",
                title="Test Track Two",
                artist="Artist Two",
                genre="UKG",
                artwork_url=None,
                url="https://soundcloud.com/test/track-2",
            ),
        ],
        "track-2": [
            ProviderTrack(
                provider_track_id="track-related-2",
                title="Related Two",
                artist="Related Artist Two",
                genre="Techno",
                artwork_url=None,
                url="https://soundcloud.com/test/related-two",
            ),
            ProviderTrack(
                provider_track_id="track-related-3",
                title="Related Three",
                artist="Related Artist Three",
                genre="Garage",
                artwork_url=None,
                url="https://soundcloud.com/test/related-three",
            ),
            ProviderTrack(
                provider_track_id="track-related-4",
                title="Related Four",
                artist="Related Artist Four",
                genre="Bass",
                artwork_url=None,
                url="https://soundcloud.com/test/related-four",
            ),
            ProviderTrack(
                provider_track_id="track-related-5",
                title="Related Five",
                artist="Related Artist Five",
                genre="House",
                artwork_url=None,
                url="https://soundcloud.com/test/related-five",
            ),
            ProviderTrack(
                provider_track_id="track-related-6",
                title="Related Six",
                artist="Related Artist Six",
                genre="House",
                artwork_url=None,
                url="https://soundcloud.com/test/related-six",
            ),
        ],
    }
    DummyProvider.related_tracks_calls = []
    DummyProvider.fail_related_status_code = None

    def _factory(provider: str, access_token: str):
        return DummyProvider(access_token)

    monkeypatch.setattr(provider_session, "get_music_provider", _factory)
    return DummyProvider
