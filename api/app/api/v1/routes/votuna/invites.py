"""Votuna invite routes."""
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.votuna_invite import VotunaPlaylistInviteCreate, VotunaPlaylistInviteOut
from app.schemas.votuna_playlist import VotunaPlaylistOut
from app.crud.votuna_playlist import votuna_playlist_crud
from app.crud.votuna_playlist_invite import votuna_playlist_invite_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.api.v1.routes.votuna.common import require_owner

router = APIRouter()


@router.post("/playlists/{playlist_id}/invites", response_model=VotunaPlaylistInviteOut)
def create_invite(
    playlist_id: int,
    payload: VotunaPlaylistInviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create an invite link for a playlist."""
    require_owner(db, playlist_id, current_user.id)
    expires_at = None
    if payload.expires_in_hours:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)
    invite = votuna_playlist_invite_crud.create(
        db,
        {
            "playlist_id": playlist_id,
            "token": token_urlsafe(16),
            "expires_at": expires_at,
            "max_uses": payload.max_uses,
            "uses_count": 0,
            "is_revoked": False,
            "created_by_user_id": current_user.id,
        },
    )
    return invite


@router.post("/invites/{token}/join", response_model=VotunaPlaylistOut)
def join_with_invite(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Join a playlist using an invite token."""
    invite = votuna_playlist_invite_crud.get_by_token(db, token)
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")
    if invite.is_revoked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite revoked")
    expires_at = invite.expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite expired")
    if invite.max_uses is not None and invite.uses_count >= invite.max_uses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite fully used")

    membership = votuna_playlist_member_crud.get_member(db, invite.playlist_id, current_user.id)
    if not membership:
        votuna_playlist_member_crud.create(
            db,
            {
                "playlist_id": invite.playlist_id,
                "user_id": current_user.id,
                "role": "member",
                "joined_at": datetime.now(timezone.utc),
            },
        )
        votuna_playlist_invite_crud.update(
            db,
            invite,
            {"uses_count": invite.uses_count + 1},
        )
    playlist = votuna_playlist_crud.get(db, invite.playlist_id)
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found")
    return playlist
