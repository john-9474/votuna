"""Per-user declined recommendation records for Votuna playlists."""

from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class VotunaTrackRecommendationDecline(BaseModel):
    """Tracks recommendations a user declined for a specific playlist."""

    __tablename__ = "votuna_track_recommendation_declines"
    __table_args__ = (
        UniqueConstraint(
            "playlist_id",
            "user_id",
            "provider_track_id",
            name="uq_votuna_track_recommendation_decline",
        ),
    )

    playlist_id = Column(Integer, ForeignKey("votuna_playlists.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_track_id = Column(String, nullable=False, index=True)
    declined_at = Column(DateTime(timezone=True), nullable=False)

    playlist = relationship("VotunaPlaylist", back_populates="recommendation_declines")
    user = relationship("User", back_populates="votuna_recommendation_declines")
