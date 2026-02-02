"""User settings schemas"""
from datetime import datetime
from pydantic import BaseModel


class UserSettingsBase(BaseModel):
    theme: str = "system"
    receive_emails: bool = True


class UserSettingsUpdate(BaseModel):
    theme: str | None = None
    receive_emails: bool | None = None


class UserSettingsOut(UserSettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
