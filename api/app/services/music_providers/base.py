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
    artwork_url: str | None = None
    url: str | None = None


class MusicProviderClient:
    """Abstract provider client interface."""

    provider: str

    def __init__(self, access_token: str):
        self.access_token = access_token

    async def list_playlists(self) -> Sequence[ProviderPlaylist]:
        raise NotImplementedError

    async def get_playlist(self, provider_playlist_id: str) -> ProviderPlaylist:
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

    async def track_exists(self, provider_playlist_id: str, track_id: str) -> bool:
        tracks = await self.list_tracks(provider_playlist_id)
        return any(track.provider_track_id == track_id for track in tracks)
