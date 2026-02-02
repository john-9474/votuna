"""User CRUD helpers"""
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.crud.base import BaseCRUD
from app.models.user import User


class UserCRUD(BaseCRUD[User, dict[str, Any], dict[str, Any]]):
    def get_by_provider_id(self, db: Session, provider: str, provider_user_id: str) -> Optional[User]:
        """Return a user by provider and provider user id."""
        return (
            db.query(User)
            .filter(User.auth_provider == provider, User.provider_user_id == provider_user_id)
            .first()
        )


user_crud = UserCRUD(User)
