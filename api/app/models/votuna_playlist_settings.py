"""Votuna playlist settings model"""

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class VotunaPlaylistSettings(BaseModel):
    """Voting and collaboration settings per Votuna playlist."""

    __tablename__ = "votuna_playlist_settings"

    playlist_id = Column(Integer, ForeignKey("votuna_playlists.id", ondelete="CASCADE"), unique=True, nullable=False)
    required_vote_percent = Column(Integer, default=60, nullable=False)
    tie_break_mode = Column(String, default="add", nullable=False)

    playlist = relationship("VotunaPlaylist", back_populates="settings")
