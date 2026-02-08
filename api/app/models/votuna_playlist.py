"""Votuna playlist models"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class VotunaPlaylist(BaseModel):
    """Application-level playlist overlay for provider playlists."""

    __tablename__ = "votuna_playlists"
    __table_args__ = (
        UniqueConstraint("provider", "provider_playlist_id", name="uq_votuna_playlists_provider_playlist"),
    )

    owner_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String, nullable=False)
    provider_playlist_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)

    owner = relationship("User", back_populates="votuna_playlists")
    settings = relationship(
        "VotunaPlaylistSettings",
        back_populates="playlist",
        uselist=False,
        cascade="all, delete-orphan",
    )
    members = relationship(
        "VotunaPlaylistMember",
        back_populates="playlist",
        cascade="all, delete-orphan",
    )
    invites = relationship(
        "VotunaPlaylistInvite",
        back_populates="playlist",
        cascade="all, delete-orphan",
    )
    suggestions = relationship(
        "VotunaTrackSuggestion",
        back_populates="playlist",
        cascade="all, delete-orphan",
    )
    track_additions = relationship(
        "VotunaTrackAddition",
        back_populates="playlist",
        cascade="all, delete-orphan",
    )
    recommendation_declines = relationship(
        "VotunaTrackRecommendationDecline",
        back_populates="playlist",
        cascade="all, delete-orphan",
    )


