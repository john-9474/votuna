"""Votuna playlist schemas"""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict

from app.schemas.votuna_playlist_settings import VotunaPlaylistSettingsOut

MusicProvider = Literal["soundcloud", "spotify", "apple", "tidal"]
TrackAddedSource = Literal["votuna_suggestion", "playlist_utils", "outside_votuna", "personal_add"]


class ProviderPlaylistOut(BaseModel):
    provider: MusicProvider
    provider_playlist_id: str
    title: str
    description: str | None = None
    image_url: str | None = None
    track_count: int | None = None
    is_public: bool | None = None


class ProviderPlaylistCreate(BaseModel):
    title: str
    description: str | None = None
    is_public: bool | None = None


class ProviderTrackOut(BaseModel):
    provider_track_id: str
    title: str
    artist: str | None = None
    genre: str | None = None
    artwork_url: str | None = None
    url: str | None = None
    added_at: datetime | None = None
    added_source: TrackAddedSource = "outside_votuna"
    added_by_label: str | None = None
    suggested_by_user_id: int | None = None
    suggested_by_display_name: str | None = None


class ProviderTrackAddRequest(BaseModel):
    provider_track_id: str | None = None
    track_title: str | None = None
    track_artist: str | None = None
    track_artwork_url: str | None = None
    track_url: str | None = None


class VotunaPlaylistCreate(BaseModel):
    provider: MusicProvider = "soundcloud"
    provider_playlist_id: str | None = None
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    is_public: bool | None = None


class VotunaPlaylistOut(BaseModel):
    id: int
    owner_user_id: int
    provider: MusicProvider
    provider_playlist_id: str
    title: str
    description: str | None = None
    image_url: str | None = None
    is_active: bool
    last_synced_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VotunaPlaylistDetail(VotunaPlaylistOut):
    settings: VotunaPlaylistSettingsOut | None = None


class VotunaPlaylistPersonalizeOut(BaseModel):
    playlist_type: Literal["personal"]
    removed_collaborators: int
    revoked_invites: int
    canceled_suggestions: int
