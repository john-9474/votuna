"""Votuna route grouping."""
from fastapi import APIRouter

from app.api.v1.routes.votuna.playlists import router as playlists_router
from app.api.v1.routes.votuna.members import router as members_router
from app.api.v1.routes.votuna.invites import router as invites_router
from app.api.v1.routes.votuna.suggestions import router as suggestions_router

router = APIRouter()
router.include_router(playlists_router)
router.include_router(members_router)
router.include_router(invites_router)
router.include_router(suggestions_router)
