"""Votuna playlist member models"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


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
