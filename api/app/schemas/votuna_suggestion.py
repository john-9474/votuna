"""Votuna suggestion schemas"""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

SuggestionReaction = Literal["up", "down"]
SuggestionStatus = Literal["pending", "accepted", "rejected", "canceled"]
SuggestionResolutionReason = Literal[
    "threshold_met",
    "threshold_not_met",
    "tie_add",
    "tie_reject",
    "force_add",
    "canceled_by_suggester",
    "canceled_by_owner",
]


class VotunaTrackSuggestionCreate(BaseModel):
    provider_track_id: str | None = None
    track_title: str | None = None
    track_artist: str | None = None
    track_artwork_url: str | None = None
    track_url: str | None = None
    allow_resuggest: bool = False


class VotunaTrackReactionUpdate(BaseModel):
    reaction: SuggestionReaction | None = None


class VotunaTrackRecommendationDeclineCreate(BaseModel):
    provider_track_id: str


class VotunaTrackSuggestionOut(BaseModel):
    id: int
    playlist_id: int
    provider_track_id: str
    track_title: str | None = None
    track_artist: str | None = None
    track_artwork_url: str | None = None
    track_url: str | None = None
    suggested_by_user_id: int | None = None
    status: SuggestionStatus
    resolution_reason: SuggestionResolutionReason | None = None
    resolved_at: datetime | None = None
    upvote_count: int
    downvote_count: int
    my_reaction: SuggestionReaction | None = None
    upvoter_display_names: list[str] = Field(default_factory=list)
    downvoter_display_names: list[str] = Field(default_factory=list)
    collaborators_left_to_vote_count: int = 0
    collaborators_left_to_vote_names: list[str] = Field(default_factory=list)
    can_cancel: bool = False
    can_force_add: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
