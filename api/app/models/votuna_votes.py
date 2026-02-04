"""Votuna track vote models"""
from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class VotunaTrackVote(BaseModel):
    """Upvotes for track suggestions."""

    __tablename__ = "votuna_track_votes"
    __table_args__ = (UniqueConstraint("suggestion_id", "user_id", name="uq_votuna_track_vote"),)

    suggestion_id = Column(Integer, ForeignKey("votuna_track_suggestions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    suggestion = relationship("VotunaTrackSuggestion", back_populates="votes")
    user = relationship("User", back_populates="votuna_votes")
