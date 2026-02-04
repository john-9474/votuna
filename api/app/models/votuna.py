"""Votuna playlist collaboration models"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint, func
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


class VotunaPlaylistSettings(BaseModel):
    """Voting and collaboration settings per Votuna playlist."""
    __tablename__ = "votuna_playlist_settings"

    playlist_id = Column(Integer, ForeignKey("votuna_playlists.id", ondelete="CASCADE"), unique=True, nullable=False)
    required_vote_percent = Column(Integer, default=60, nullable=False)
    auto_add_on_threshold = Column(Boolean, default=True, nullable=False)

    playlist = relationship("VotunaPlaylist", back_populates="settings")


class VotunaPlaylistMember(BaseModel):
    """Membership for Votuna playlists."""
    __tablename__ = "votuna_playlist_members"
    __table_args__ = (UniqueConstraint("playlist_id", "user_id", name="uq_votuna_playlist_member"),)

    playlist_id = Column(Integer, ForeignKey("votuna_playlists.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, default="member", nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    playlist = relationship("VotunaPlaylist", back_populates="members")
    user = relationship("User", back_populates="votuna_memberships")


class VotunaPlaylistInvite(BaseModel):
    """Invite links for joining a Votuna playlist."""
    __tablename__ = "votuna_playlist_invites"

    playlist_id = Column(Integer, ForeignKey("votuna_playlists.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    max_uses = Column(Integer, nullable=True)
    uses_count = Column(Integer, default=0, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    playlist = relationship("VotunaPlaylist", back_populates="invites")


class VotunaTrackSuggestion(BaseModel):
    """Track suggestions for Votuna playlists."""
    __tablename__ = "votuna_track_suggestions"

    playlist_id = Column(Integer, ForeignKey("votuna_playlists.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_track_id = Column(String, nullable=False, index=True)
    track_title = Column(String, nullable=True)
    track_artist = Column(String, nullable=True)
    track_artwork_url = Column(String, nullable=True)
    track_url = Column(String, nullable=True)
    suggested_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, default="pending", nullable=False)

    playlist = relationship("VotunaPlaylist", back_populates="suggestions")
    votes = relationship(
        "VotunaTrackVote",
        back_populates="suggestion",
        cascade="all, delete-orphan",
    )


class VotunaTrackVote(BaseModel):
    """Upvotes for track suggestions."""
    __tablename__ = "votuna_track_votes"
    __table_args__ = (UniqueConstraint("suggestion_id", "user_id", name="uq_votuna_track_vote"),)

    suggestion_id = Column(Integer, ForeignKey("votuna_track_suggestions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    suggestion = relationship("VotunaTrackSuggestion", back_populates="votes")
    user = relationship("User", back_populates="votuna_votes")
