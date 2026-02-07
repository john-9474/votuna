"""Shared invite helpers for Votuna invite flows."""
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud.votuna_playlist import votuna_playlist_crud
from app.crud.votuna_playlist_invite import votuna_playlist_invite_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.models.user import User
from app.models.votuna_invites import VotunaPlaylistInvite


def ensure_invite_is_active(invite: VotunaPlaylistInvite) -> None:
    """Raise if an invite can no longer be used."""
    if invite.is_revoked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite revoked")
    expires_at = invite.expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite expired")
    if invite.max_uses is not None and invite.uses_count >= invite.max_uses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite fully used")


def ensure_targeted_invite_matches_user(invite: VotunaPlaylistInvite, user: User) -> None:
    """Validate that a targeted invite is being accepted by the intended identity."""
    if invite.invite_type != "user":
        return
    if invite.target_auth_provider and invite.target_auth_provider != user.auth_provider:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invite is targeted to a different provider account",
        )
    if invite.target_provider_user_id and invite.target_provider_user_id != user.provider_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invite is targeted to a different user",
        )
    if invite.target_user_id and invite.target_user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invite is targeted to a different user",
        )


def join_invite(db: Session, invite: VotunaPlaylistInvite, user: User):
    """Accept an invite and ensure membership exists."""
    ensure_invite_is_active(invite)
    ensure_targeted_invite_matches_user(invite, user)

    membership = votuna_playlist_member_crud.get_member(db, invite.playlist_id, user.id)
    update_data: dict[str, object] = {}
    if not membership:
        votuna_playlist_member_crud.create(
            db,
            {
                "playlist_id": invite.playlist_id,
                "user_id": user.id,
                "role": "member",
                "joined_at": datetime.now(timezone.utc),
            },
        )
        update_data["uses_count"] = invite.uses_count + 1

    if invite.accepted_at is None:
        update_data["accepted_at"] = datetime.now(timezone.utc)
        update_data["accepted_by_user_id"] = user.id

    if update_data:
        votuna_playlist_invite_crud.update(db, invite, update_data)

    playlist = votuna_playlist_crud.get(db, invite.playlist_id)
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found")
    return playlist


def join_invite_by_token(db: Session, token: str, user: User):
    """Lookup and join an invite by token."""
    invite = votuna_playlist_invite_crud.get_by_token(db, token)
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")
    return join_invite(db, invite, user)


def auto_accept_pending_targeted_invites(db: Session, user: User) -> list[int]:
    """Auto-accept targeted invites after successful login."""
    invite_rows = votuna_playlist_invite_crud.list_pending_user_invites_for_identity(
        db=db,
        auth_provider=user.auth_provider,
        provider_user_id=user.provider_user_id,
        user_id=user.id,
    )
    joined_playlist_ids: list[int] = []
    for invite in invite_rows:
        try:
            playlist = join_invite(db, invite, user)
            joined_playlist_ids.append(playlist.id)
        except HTTPException:
            # Keep login resilient even if one pending invite is invalid.
            continue
    return joined_playlist_ids

