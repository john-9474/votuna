"""Base classes for music provider integrations."""
from dataclasses import dataclass
from typing import Sequence


class ProviderAuthError(Exception):
    """Raised when provider auth is missing or expired."""


class ProviderAPIError(Exception):
    """Raised when provider API returns a non-auth error."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass
class ProviderPlaylist:
    provider: str
    provider_playlist_id: str
    title: str
    description: str | None = None
    image_url: str | None = None
    track_count: int | None = None
    is_public: bool | None = None


@dataclass
class ProviderTrack:
    provider_track_id: str
    title: str
    artist: str | None = None
    genre: str | None = None
    artwork_url: str | None = None
    url: str | None = None


@dataclass
class ProviderUser:
    provider_user_id: str
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    profile_url: str | None = None


class MusicProviderClient:
    """Abstract provider client interface."""

    provider: str

    def __init__(self, access_token: str):
        self.access_token = access_token

    async def list_playlists(self) -> Sequence[ProviderPlaylist]:
        raise NotImplementedError

    async def get_playlist(self, provider_playlist_id: str) -> ProviderPlaylist:
        raise NotImplementedError

    async def search_playlists(self, query: str, limit: int = 10) -> Sequence[ProviderPlaylist]:
        """Search playlists by free-text query."""
        raise NotImplementedError

    async def resolve_playlist_url(self, url: str) -> ProviderPlaylist:
        """Resolve a provider playlist URL to canonical playlist metadata."""
        raise NotImplementedError

    async def create_playlist(
        self,
        title: str,
        description: str | None = None,
        is_public: bool | None = None,
    ) -> ProviderPlaylist:
        raise NotImplementedError

    async def list_tracks(self, provider_playlist_id: str) -> Sequence[ProviderTrack]:
        raise NotImplementedError

    async def add_tracks(self, provider_playlist_id: str, track_ids: Sequence[str]) -> None:
        raise NotImplementedError

    async def remove_tracks(self, provider_playlist_id: str, track_ids: Sequence[str]) -> None:
        raise NotImplementedError

    async def search_tracks(self, query: str, limit: int = 10) -> Sequence[ProviderTrack]:
        """Search tracks by free-text query."""
        raise NotImplementedError

    async def resolve_track_url(self, url: str) -> ProviderTrack:
        """Resolve a provider track URL to canonical track metadata."""
        raise NotImplementedError

    async def search_users(self, query: str, limit: int = 10) -> Sequence[ProviderUser]:
        """Search provider users by free-text query."""
        raise NotImplementedError

    async def get_user(self, provider_user_id: str) -> ProviderUser:
        """Fetch a provider user by provider-specific id."""
        raise NotImplementedError

    async def track_exists(self, provider_playlist_id: str, track_id: str) -> bool:
        tracks = await self.list_tracks(provider_playlist_id)
        return any(track.provider_track_id == track_id for track in tracks)
