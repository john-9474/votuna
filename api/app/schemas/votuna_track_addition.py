"""Votuna track addition schemas."""

from datetime import datetime

from pydantic import BaseModel


class VotunaTrackAdditionBase(BaseModel):
    playlist_id: int
    provider_track_id: str
    source: str
    added_at: datetime
    added_by_user_id: int | None = None
    suggestion_id: int | None = None


class VotunaTrackAdditionCreate(VotunaTrackAdditionBase):
    pass


class VotunaTrackAdditionUpdate(BaseModel):
    playlist_id: int | None = None
    provider_track_id: str | None = None
    source: str | None = None
    added_at: datetime | None = None
    added_by_user_id: int | None = None
    suggestion_id: int | None = None
