"""Votuna playlist invite CRUD helpers"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.crud.base import BaseCRUD
from app.models.votuna_invites import VotunaPlaylistInvite


class VotunaPlaylistInviteCRUD(BaseCRUD[VotunaPlaylistInvite, dict, dict]):
    def get_by_token(self, db: Session, token: str) -> Optional[VotunaPlaylistInvite]:
        """Return the invite row by token."""
        return db.query(VotunaPlaylistInvite).filter(VotunaPlaylistInvite.token == token).first()

    def get_active_user_invite(
        self,
        db: Session,
        playlist_id: int,
        auth_provider: str,
        provider_user_id: str,
    ) -> Optional[VotunaPlaylistInvite]:
        """Return a still-active targeted invite for a provider identity."""
        return (
            db.query(VotunaPlaylistInvite)
            .filter(
                VotunaPlaylistInvite.playlist_id == playlist_id,
                VotunaPlaylistInvite.invite_type == "user",
                VotunaPlaylistInvite.target_auth_provider == auth_provider,
                VotunaPlaylistInvite.target_provider_user_id == provider_user_id,
                VotunaPlaylistInvite.is_revoked.is_(False),
                VotunaPlaylistInvite.accepted_at.is_(None),
            )
            .order_by(VotunaPlaylistInvite.created_at.desc())
            .first()
        )

    def list_pending_user_invites_for_identity(
        self,
        db: Session,
        auth_provider: str,
        provider_user_id: str,
        user_id: int,
    ) -> list[VotunaPlaylistInvite]:
        """List pending targeted invites that match the provider identity."""
        return (
            db.query(VotunaPlaylistInvite)
            .filter(
                VotunaPlaylistInvite.invite_type == "user",
                VotunaPlaylistInvite.target_auth_provider == auth_provider,
                VotunaPlaylistInvite.target_provider_user_id == provider_user_id,
                VotunaPlaylistInvite.is_revoked.is_(False),
                VotunaPlaylistInvite.accepted_at.is_(None),
                or_(
                    VotunaPlaylistInvite.target_user_id.is_(None),
                    VotunaPlaylistInvite.target_user_id == user_id,
                ),
            )
            .order_by(VotunaPlaylistInvite.created_at.asc())
            .all()
        )

    def list_active_for_playlist(
        self,
        db: Session,
        playlist_id: int,
    ) -> list[VotunaPlaylistInvite]:
        """List active, non-accepted invites for a playlist."""
        now = datetime.now(timezone.utc)
        invites = (
            db.query(VotunaPlaylistInvite)
            .filter(
                VotunaPlaylistInvite.playlist_id == playlist_id,
                VotunaPlaylistInvite.is_revoked.is_(False),
                VotunaPlaylistInvite.accepted_at.is_(None),
            )
            .order_by(VotunaPlaylistInvite.created_at.desc())
            .all()
        )
        active: list[VotunaPlaylistInvite] = []
        for invite in invites:
            expires_at = invite.expires_at
            if expires_at and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at and expires_at < now:
                continue
            if invite.max_uses is not None and invite.uses_count >= invite.max_uses:
                continue
            active.append(invite)
        return active


votuna_playlist_invite_crud = VotunaPlaylistInviteCRUD(VotunaPlaylistInvite)
