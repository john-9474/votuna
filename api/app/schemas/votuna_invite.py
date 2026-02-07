"""Votuna playlist invite schemas"""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict

from app.schemas.votuna_playlist import MusicProvider


class VotunaPlaylistInviteCreateLink(BaseModel):
    kind: Literal["link"] = "link"
    expires_in_hours: int | None = None
    max_uses: int | None = None


class VotunaPlaylistInviteCreateUser(BaseModel):
    kind: Literal["user"] = "user"
    target_provider_user_id: str


VotunaPlaylistInviteCreate = VotunaPlaylistInviteCreateLink | VotunaPlaylistInviteCreateUser


class VotunaInviteCandidateOut(BaseModel):
    source: Literal["registered", "provider"]
    provider_user_id: str
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    profile_url: str | None = None
    is_registered: bool
    registered_user_id: int | None = None


class VotunaPlaylistInviteOut(BaseModel):
    id: int
    playlist_id: int
    invite_type: Literal["link", "user"]
    token: str
    expires_at: datetime | None = None
    max_uses: int | None = None
    uses_count: int
    is_revoked: bool
    target_auth_provider: MusicProvider | None = None
    target_provider_user_id: str | None = None
    target_username_snapshot: str | None = None
    target_display_name: str | None = None
    target_username: str | None = None
    target_avatar_url: str | None = None
    target_user_id: int | None = None
    accepted_by_user_id: int | None = None
    accepted_at: datetime | None = None
    invite_url: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
