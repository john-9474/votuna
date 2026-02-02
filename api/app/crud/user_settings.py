"""User settings CRUD helpers"""
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.crud.base import BaseCRUD
from app.models.user_settings import UserSettings


class UserSettingsCRUD(BaseCRUD[UserSettings, dict[str, Any], dict[str, Any]]):
    def get_by_user_id(self, db: Session, user_id: int) -> Optional[UserSettings]:
        """Return the settings row for the given user id."""
        return db.query(UserSettings).filter(UserSettings.user_id == user_id).first()


user_settings_crud = UserSettingsCRUD(UserSettings)
