"""User settings model"""
from sqlalchemy import Column, Integer, Boolean, String, ForeignKey
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class UserSettings(BaseModel):
    """Per-user settings"""
    __tablename__ = "user_settings"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    theme = Column(String, default="system", nullable=False)
    receive_emails = Column(Boolean, default=True, nullable=False)

    user = relationship("User", back_populates="settings")
