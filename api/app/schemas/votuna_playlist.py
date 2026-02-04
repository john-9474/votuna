"""Votuna playlist schemas"""
from __future__ import annotations
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

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


class VotunaPlaylistSettingsBase(BaseModel):
    required_vote_percent: int = Field(60, ge=1, le=100)
    auto_add_on_threshold: bool = True


class VotunaPlaylistSettingsUpdate(BaseModel):
    required_vote_percent: int | None = Field(default=None, ge=1, le=100)
    auto_add_on_threshold: bool | None = None


class VotunaPlaylistSettingsOut(VotunaPlaylistSettingsBase):
    id: int
    playlist_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VotunaPlaylistMemberOut(BaseModel):
    user_id: int
    display_name: str | None = None
    avatar_url: str | None = None
    role: str
    joined_at: datetime
    suggested_count: int = 0


class VotunaPlaylistDetail(VotunaPlaylistOut):
    settings: VotunaPlaylistSettingsOut | None = None
