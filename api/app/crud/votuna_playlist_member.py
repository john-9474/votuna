"""Votuna playlist member CRUD helpers"""

from typing import Optional
from sqlalchemy.orm import Session

from app.crud.base import BaseCRUD
from app.models.user import User
from app.models.votuna_members import VotunaPlaylistMember


class VotunaPlaylistMemberCRUD(BaseCRUD[VotunaPlaylistMember, dict, dict]):
    def get_member(self, db: Session, playlist_id: int, user_id: int) -> Optional[VotunaPlaylistMember]:
        """Return a membership row if it exists."""
        return (
            db.query(VotunaPlaylistMember)
            .filter(
                VotunaPlaylistMember.playlist_id == playlist_id,
                VotunaPlaylistMember.user_id == user_id,
            )
            .first()
        )

    def count_members(self, db: Session, playlist_id: int) -> int:
        """Count members for the playlist."""
        return db.query(VotunaPlaylistMember).filter(VotunaPlaylistMember.playlist_id == playlist_id).count()

    def count_non_owner_members(self, db: Session, playlist_id: int, owner_user_id: int) -> int:
        """Count collaborators excluding the owner."""
        return (
            db.query(VotunaPlaylistMember)
            .filter(
                VotunaPlaylistMember.playlist_id == playlist_id,
                VotunaPlaylistMember.user_id != owner_user_id,
            )
            .count()
        )

    def has_non_owner_members(self, db: Session, playlist_id: int, owner_user_id: int) -> bool:
        """Return whether the playlist currently has collaborators."""
        return self.count_non_owner_members(db, playlist_id, owner_user_id) > 0

    def list_members(self, db: Session, playlist_id: int) -> list[tuple[VotunaPlaylistMember, User]]:
        """List members with user data for the playlist."""
        return (
            db.query(VotunaPlaylistMember, User)
            .join(User, User.id == VotunaPlaylistMember.user_id)
            .filter(VotunaPlaylistMember.playlist_id == playlist_id)
            .order_by(VotunaPlaylistMember.joined_at.asc())
            .all()
        )


votuna_playlist_member_crud = VotunaPlaylistMemberCRUD(VotunaPlaylistMember)
