"""Votuna playlist member schemas"""
from datetime import datetime
from pydantic import BaseModel


class VotunaPlaylistMemberOut(BaseModel):
    user_id: int
    display_name: str | None = None
    avatar_url: str | None = None
    role: str
    joined_at: datetime
    suggested_count: int = 0
