"""Auth schemas"""

from pydantic import BaseModel, Field

from app.schemas.user import UserOut


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    user: UserOut
    token: AuthToken


class AppleMusicKitConfigOut(BaseModel):
    developer_token: str
    storefront: str


class AppleMusicUserTokenIn(BaseModel):
    music_user_token: str = Field(min_length=1, max_length=4096)
