"""User settings schemas"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

TablePageSizeSetting = Literal[10, 25, 50, 100]


class UserSettingsBase(BaseModel):
    theme: Literal["system", "light", "dark"] = "system"
    receive_emails: bool = True
    default_table_page_size: TablePageSizeSetting = 10


class UserSettingsCreate(UserSettingsBase):
    pass


class UserSettingsUpdate(BaseModel):
    theme: Literal["system", "light", "dark"] | None = None
    receive_emails: bool | None = None
    default_table_page_size: TablePageSizeSetting | None = None


class UserSettingsOut(UserSettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
