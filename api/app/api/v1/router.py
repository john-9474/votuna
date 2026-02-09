"""API v1 routes"""

from fastapi import APIRouter

from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.playlists import router as playlists_router
from app.api.v1.routes.users import router as users_router
from app.api.v1.routes.votuna import router as votuna_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(playlists_router, prefix="/playlists", tags=["playlists"])
router.include_router(users_router, prefix="/users", tags=["users"])
router.include_router(votuna_router, prefix="/votuna", tags=["votuna"])
