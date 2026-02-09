"""Auth schemas"""

from pydantic import BaseModel

from app.schemas.user import UserOut


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    user: UserOut
    token: AuthToken
