"""User settings model"""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User


class UserSettings(BaseModel):
    """Per-user settings"""

    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    theme: Mapped[str] = mapped_column(default="system", nullable=False)
    receive_emails: Mapped[bool] = mapped_column(default=True)
    default_table_page_size: Mapped[int] = mapped_column(default=10, nullable=False)

    user: Mapped["User"] = relationship(back_populates="settings")
