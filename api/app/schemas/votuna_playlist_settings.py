"""Votuna playlist settings schemas"""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

TieBreakMode = Literal["add", "reject"]


class VotunaPlaylistSettingsBase(BaseModel):
    required_vote_percent: int = Field(60, ge=1, le=100)
    tie_break_mode: TieBreakMode = "add"


class VotunaPlaylistSettingsUpdate(BaseModel):
    required_vote_percent: int | None = Field(default=None, ge=1, le=100)
    tie_break_mode: TieBreakMode | None = None


class VotunaPlaylistSettingsOut(VotunaPlaylistSettingsBase):
    id: int
    playlist_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
