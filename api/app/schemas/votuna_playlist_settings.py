"""Votuna playlist settings schemas"""
from datetime import datetime
from pydantic import BaseModel, Field


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
