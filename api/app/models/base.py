"""Base model class for all database models"""

from sqlalchemy import Column, Integer, DateTime, func
from app.db.session import Base


class BaseModel(Base):
    """Base model with common fields for all database models"""

    __abstract__ = True

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        """Return a debug-friendly representation of the model instance."""
        return f"<{self.__class__.__name__}(id={self.id})>"
