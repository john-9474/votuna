"""Votuna track suggestion models"""
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


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
