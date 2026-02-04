"""Votuna playlist CRUD helpers"""
from typing import Optional, Sequence
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.crud.base import BaseCRUD
from app.models.votuna_playlist import VotunaPlaylist


class VotunaPlaylistCRUD(BaseCRUD[VotunaPlaylist, dict, dict]):
    def get_by_provider_playlist_id(
        self,
        db: Session,
        provider: str,
        provider_playlist_id: str,
    ) -> Optional[VotunaPlaylist]:
        """Return a playlist by provider playlist id."""
        return (
            db.query(VotunaPlaylist)
            .filter(
                VotunaPlaylist.provider == provider,
                VotunaPlaylist.provider_playlist_id == provider_playlist_id,
            )
            .first()
        )

    def list_for_user(self, db: Session, user_id: int) -> Sequence[VotunaPlaylist]:
        """Return playlists owned by or shared with the user."""
        from app.models.votuna_members import VotunaPlaylistMember

        return (
            db.query(VotunaPlaylist)
            .outerjoin(VotunaPlaylistMember, VotunaPlaylistMember.playlist_id == VotunaPlaylist.id)
            .filter(
                or_(
                    VotunaPlaylist.owner_user_id == user_id,
                    VotunaPlaylistMember.user_id == user_id,
                )
            )
            .distinct()
            .all()
        )


votuna_playlist_crud = VotunaPlaylistCRUD(VotunaPlaylist)
