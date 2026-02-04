"""Votuna playlist invite models"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


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
