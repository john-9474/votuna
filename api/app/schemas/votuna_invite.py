"""Votuna playlist invite schemas"""
from datetime import datetime
from pydantic import BaseModel


class VotunaPlaylistInviteCreate(BaseModel):
    expires_in_hours: int | None = None
    max_uses: int | None = None


class VotunaPlaylistInviteOut(BaseModel):
    id: int
    playlist_id: int
    token: str
    expires_at: datetime | None = None
    max_uses: int | None = None
    uses_count: int
    is_revoked: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True