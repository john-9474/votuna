"""User schemas"""
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class UserBase(BaseModel):
    auth_provider: str | None = None
    provider_user_id: str | None = None
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None


class UserUpdate(BaseModel):
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
