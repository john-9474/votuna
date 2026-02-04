"""Votuna suggestion routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.votuna_playlist import VotunaPlaylist
from app.models.votuna_suggestions import VotunaTrackSuggestion
from app.schemas.votuna_suggestion import VotunaTrackSuggestionCreate, VotunaTrackSuggestionOut
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud
from app.crud.votuna_track_suggestion import votuna_track_suggestion_crud
from app.crud.votuna_track_vote import votuna_track_vote_crud
from app.services.music_providers import ProviderAPIError, ProviderAuthError
from app.api.v1.routes.votuna.common import (
    get_owner_client,
    get_playlist_or_404,
    raise_provider_auth,
    require_member,
)

router = APIRouter()


def serialize_suggestion(db: Session, suggestion: VotunaTrackSuggestion) -> VotunaTrackSuggestionOut:
    vote_count = votuna_track_vote_crud.count_votes(db, suggestion.id)
    return VotunaTrackSuggestionOut(
        id=suggestion.id,
        playlist_id=suggestion.playlist_id,
        provider_track_id=suggestion.provider_track_id,
        track_title=suggestion.track_title,
        track_artist=suggestion.track_artist,
        track_artwork_url=suggestion.track_artwork_url,
        track_url=suggestion.track_url,
        suggested_by_user_id=suggestion.suggested_by_user_id,
        status=suggestion.status,
        vote_count=vote_count,
        created_at=suggestion.created_at,
        updated_at=suggestion.updated_at,
    )


def is_threshold_met(votes: int, members: int, required_percent: int) -> bool:
    if members <= 0:
        return False
    percent = (votes / members) * 100
    return percent >= required_percent


async def maybe_auto_add_track(
    db: Session,
    playlist: VotunaPlaylist,
    suggestion: VotunaTrackSuggestion,
) -> None:
    settings = votuna_playlist_settings_crud.get_by_playlist_id(db, playlist.id)
    if not settings or not settings.auto_add_on_threshold:
        return
    votes = votuna_track_vote_crud.count_votes(db, suggestion.id)
    members = votuna_playlist_member_crud.count_members(db, playlist.id)
    if not is_threshold_met(votes, members, settings.required_vote_percent):
        return
    client = get_owner_client(db, playlist)
    await client.add_tracks(playlist.provider_playlist_id, [suggestion.provider_track_id])
    votuna_track_suggestion_crud.update(
        db,
        suggestion,
        {"status": "accepted"},
    )


@router.get("/playlists/{playlist_id}/suggestions", response_model=list[VotunaTrackSuggestionOut])
def list_suggestions(
    playlist_id: int,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List suggestions for a playlist."""
    require_member(db, playlist_id, current_user.id)
    suggestions = votuna_track_suggestion_crud.list_for_playlist(db, playlist_id, status)
    return [serialize_suggestion(db, suggestion) for suggestion in suggestions]


@router.post("/playlists/{playlist_id}/suggestions", response_model=VotunaTrackSuggestionOut)
async def create_suggestion(
    playlist_id: int,
    payload: VotunaTrackSuggestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Suggest a track for a playlist."""
    playlist = get_playlist_or_404(db, playlist_id)
    require_member(db, playlist_id, current_user.id)
    client = get_owner_client(db, playlist)

    try:
        if await client.track_exists(playlist.provider_playlist_id, payload.provider_track_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Track already exists in playlist",
            )
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError:
        # If the provider check fails, proceed with the suggestion to avoid blocking.
        pass
    except HTTPException:
        raise

    existing = votuna_track_suggestion_crud.get_pending_by_track(
        db,
        playlist_id,
        payload.provider_track_id,
    )
    if existing:
        if not votuna_track_vote_crud.has_vote(db, existing.id, current_user.id):
            votuna_track_vote_crud.create(
                db,
                {
                    "suggestion_id": existing.id,
                    "user_id": current_user.id,
                },
            )
            try:
                await maybe_auto_add_track(db, playlist, existing)
            except ProviderAuthError:
                raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
            except ProviderAPIError as exc:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
        return serialize_suggestion(db, existing)

    suggestion = votuna_track_suggestion_crud.create(
        db,
        {
            "playlist_id": playlist_id,
            "provider_track_id": payload.provider_track_id,
            "track_title": payload.track_title,
            "track_artist": payload.track_artist,
            "track_artwork_url": payload.track_artwork_url,
            "track_url": payload.track_url,
            "suggested_by_user_id": current_user.id,
            "status": "pending",
        },
    )
    votuna_track_vote_crud.create(
        db,
        {
            "suggestion_id": suggestion.id,
            "user_id": current_user.id,
        },
    )
    try:
        await maybe_auto_add_track(db, playlist, suggestion)
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return serialize_suggestion(db, suggestion)


@router.post("/suggestions/{suggestion_id}/vote", response_model=VotunaTrackSuggestionOut)
async def vote_on_suggestion(
    suggestion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upvote a track suggestion."""
    suggestion = votuna_track_suggestion_crud.get(db, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")
    playlist = get_playlist_or_404(db, suggestion.playlist_id)
    require_member(db, suggestion.playlist_id, current_user.id)
    if suggestion.status != "pending":
        return serialize_suggestion(db, suggestion)
    if not votuna_track_vote_crud.has_vote(db, suggestion.id, current_user.id):
        votuna_track_vote_crud.create(
            db,
            {
                "suggestion_id": suggestion.id,
                "user_id": current_user.id,
            },
        )
        try:
            await maybe_auto_add_track(db, playlist, suggestion)
        except ProviderAuthError:
            raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
        except ProviderAPIError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return serialize_suggestion(db, suggestion)
