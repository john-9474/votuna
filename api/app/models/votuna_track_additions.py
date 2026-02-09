"""Track addition provenance records."""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class VotunaTrackAddition(BaseModel):
    """Stores how and when a track was added to a playlist."""

    __tablename__ = "votuna_track_additions"

    playlist_id = Column(Integer, ForeignKey("votuna_playlists.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_track_id = Column(String, nullable=False, index=True)
    source = Column(String, nullable=False)
    added_at = Column(DateTime(timezone=True), nullable=False)
    added_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    suggestion_id = Column(Integer, ForeignKey("votuna_track_suggestions.id", ondelete="SET NULL"), nullable=True)

    playlist = relationship("VotunaPlaylist", back_populates="track_additions")
    added_by_user = relationship("User", back_populates="votuna_track_additions")
    suggestion = relationship("VotunaTrackSuggestion", back_populates="track_additions")
