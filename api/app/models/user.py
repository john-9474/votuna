"""User model"""
from sqlalchemy import Column, String, Boolean, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class User(BaseModel):
    """Application user authenticated via SSO providers"""
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("auth_provider", "provider_user_id", name="uq_users_provider_user_id"),)

    auth_provider = Column(String, index=True, nullable=False)
    provider_user_id = Column(String, index=True, nullable=False)
    email = Column(String, index=True, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    display_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)

    access_token = Column(String, nullable=True)
    refresh_token = Column(String, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)

    settings = relationship(
        "UserSettings",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    votuna_playlists = relationship(
        "VotunaPlaylist",
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    votuna_memberships = relationship(
        "VotunaPlaylistMember",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    votuna_votes = relationship(
        "VotunaTrackVote",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    votuna_track_additions = relationship(
        "VotunaTrackAddition",
        back_populates="added_by_user",
    )
    votuna_recommendation_declines = relationship(
        "VotunaTrackRecommendationDecline",
        back_populates="user",
        cascade="all, delete-orphan",
    )
