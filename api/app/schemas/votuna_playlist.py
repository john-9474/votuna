"""Votuna playlist schemas"""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel

from app.schemas.votuna_playlist_settings import VotunaPlaylistSettingsOut

MusicProvider = Literal["soundcloud", "spotify", "apple", "tidal"]


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
    artwork_url: str | None = None
    url: str | None = None


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

    class Config:
        from_attributes = True


class VotunaPlaylistDetail(VotunaPlaylistOut):
    settings: VotunaPlaylistSettingsOut | None = None
