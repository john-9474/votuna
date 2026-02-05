"""Votuna suggestion schemas"""
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class VotunaTrackSuggestionCreate(BaseModel):
    provider_track_id: str
    track_title: str | None = None
    track_artist: str | None = None
    track_artwork_url: str | None = None
    track_url: str | None = None


class VotunaTrackSuggestionOut(BaseModel):
    id: int
    playlist_id: int
    provider_track_id: str
    track_title: str | None = None
    track_artist: str | None = None
    track_artwork_url: str | None = None
    track_url: str | None = None
    suggested_by_user_id: int | None = None
    status: str
    vote_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
