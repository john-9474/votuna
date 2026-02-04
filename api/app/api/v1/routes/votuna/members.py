"""Votuna member routes."""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.votuna_suggestions import VotunaTrackSuggestion
from app.schemas.votuna_member import VotunaPlaylistMemberOut
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.api.v1.routes.votuna.common import require_member

router = APIRouter()


@router.get("/playlists/{playlist_id}/members", response_model=list[VotunaPlaylistMemberOut])
def list_votuna_members(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List members for a Votuna playlist."""
    require_member(db, playlist_id, current_user.id)
    counts = dict(
        db.query(
            VotunaTrackSuggestion.suggested_by_user_id,
            func.count(VotunaTrackSuggestion.id),
        )
        .filter(
            VotunaTrackSuggestion.playlist_id == playlist_id,
            VotunaTrackSuggestion.suggested_by_user_id.isnot(None),
        )
        .group_by(VotunaTrackSuggestion.suggested_by_user_id)
        .all()
    )
    members = votuna_playlist_member_crud.list_members(db, playlist_id)
    payload: list[VotunaPlaylistMemberOut] = []
    for member, user in members:
        display_name = user.display_name or user.first_name or user.email or user.provider_user_id
        payload.append(
            VotunaPlaylistMemberOut(
                user_id=member.user_id,
                display_name=display_name,
                avatar_url=user.avatar_url,
                role=member.role,
                joined_at=member.joined_at,
                suggested_count=int(counts.get(member.user_id, 0)),
            )
        )
    return payload
