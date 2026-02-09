"""User CRUD helpers"""

from typing import Any, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.crud.base import BaseCRUD
from app.models.user import User


class UserCRUD(BaseCRUD[User, dict[str, Any], dict[str, Any]]):
    def get_by_provider_id(self, db: Session, provider: str, provider_user_id: str) -> Optional[User]:
        """Return a user by provider and provider user id."""
        return db.query(User).filter(User.auth_provider == provider, User.provider_user_id == provider_user_id).first()

    def search_by_provider_identity(
        self,
        db: Session,
        provider: str,
        query: str,
        limit: int = 10,
        exclude_user_ids: set[int] | None = None,
    ) -> list[User]:
        """Search registered users for a provider by username/display name/email."""
        needle = query.strip()
        if needle.startswith("@"):
            needle = needle[1:].strip()
        if not needle:
            return []
        safe_limit = max(1, min(limit, 25))
        pattern = f"%{needle}%"
        candidates = (
            db.query(User)
            .filter(
                User.auth_provider == provider,
                or_(
                    User.provider_user_id.ilike(pattern),
                    User.display_name.ilike(pattern),
                    User.email.ilike(pattern),
                ),
            )
            .order_by(User.id.desc())
            .limit(safe_limit)
            .all()
        )
        if not exclude_user_ids:
            return candidates
        return [candidate for candidate in candidates if candidate.id not in exclude_user_ids]


user_crud = UserCRUD(User)
