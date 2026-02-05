"""User settings schemas"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class UserSettingsBase(BaseModel):
    theme: Literal["system", "light", "dark"] = "system"
    receive_emails: bool = True


class UserSettingsUpdate(BaseModel):
    theme: Literal["system", "light", "dark"] | None = None
    receive_emails: bool | None = None


class UserSettingsOut(UserSettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
