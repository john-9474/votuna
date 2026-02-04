"""Votuna playlist invite CRUD helpers"""
from typing import Optional
from sqlalchemy.orm import Session

from app.crud.base import BaseCRUD
from app.models.votuna_invites import VotunaPlaylistInvite


class VotunaPlaylistInviteCRUD(BaseCRUD[VotunaPlaylistInvite, dict, dict]):
    def get_by_token(self, db: Session, token: str) -> Optional[VotunaPlaylistInvite]:
        """Return the invite row by token."""
        return db.query(VotunaPlaylistInvite).filter(VotunaPlaylistInvite.token == token).first()


votuna_playlist_invite_crud = VotunaPlaylistInviteCRUD(VotunaPlaylistInvite)
