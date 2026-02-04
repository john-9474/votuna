"""Votuna playlist routes"""
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.votuna import VotunaPlaylist, VotunaTrackSuggestion
from app.crud.votuna_playlist import votuna_playlist_crud
from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_playlist_invite import votuna_playlist_invite_crud
from app.crud.votuna_track_suggestion import votuna_track_suggestion_crud
from app.crud.votuna_track_vote import votuna_track_vote_crud
from app.crud.user import user_crud
from app.schemas.votuna_playlist import (
    ProviderTrackOut,
    VotunaPlaylistCreate,
    VotunaPlaylistOut,
    VotunaPlaylistDetail,
    VotunaPlaylistMemberOut,
    VotunaPlaylistSettingsOut,
    VotunaPlaylistSettingsUpdate,
)
from app.schemas.votuna_invite import VotunaPlaylistInviteCreate, VotunaPlaylistInviteOut
from app.schemas.votuna_suggestion import VotunaTrackSuggestionCreate, VotunaTrackSuggestionOut
from app.services.music_providers import get_music_provider, ProviderAuthError, ProviderAPIError

router = APIRouter()


def _get_playlist_or_404(db: Session, playlist_id: int) -> VotunaPlaylist:
    playlist = votuna_playlist_crud.get(db, playlist_id)
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found")
    return playlist


def _require_member(db: Session, playlist_id: int, user_id: int):
    member = votuna_playlist_member_crud.get_member(db, playlist_id, user_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a playlist member")
    return member


def _require_owner(db: Session, playlist_id: int, user_id: int):
    playlist = _get_playlist_or_404(db, playlist_id)
    if playlist.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not playlist owner")
    return playlist


def _get_provider_client(provider: str, user: User):
    if not user.access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing provider access token",
        )
    try:
        return get_music_provider(provider, user.access_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


def _get_owner_client(db: Session, playlist: VotunaPlaylist):
    owner = user_crud.get(db, playlist.owner_user_id)
    if not owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist owner not found")
    return _get_provider_client(playlist.provider, owner)


def _raise_provider_auth(current_user: User, owner_id: int | None = None) -> None:
    """Raise an auth error, logging out owner or warning members."""
    if owner_id is None or current_user.id == owner_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="SoundCloud authorization expired or invalid",
        )
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Playlist owner must reconnect SoundCloud",
    )


def _serialize_suggestion(db: Session, suggestion: VotunaTrackSuggestion) -> VotunaTrackSuggestionOut:
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


def _is_threshold_met(votes: int, members: int, required_percent: int) -> bool:
    if members <= 0:
        return False
    percent = (votes / members) * 100
    return percent >= required_percent


async def _maybe_auto_add_track(
    db: Session,
    playlist: VotunaPlaylist,
    suggestion: VotunaTrackSuggestion,
) -> None:
    settings = votuna_playlist_settings_crud.get_by_playlist_id(db, playlist.id)
    if not settings or not settings.auto_add_on_threshold:
        return
    votes = votuna_track_vote_crud.count_votes(db, suggestion.id)
    members = votuna_playlist_member_crud.count_members(db, playlist.id)
    if not _is_threshold_met(votes, members, settings.required_vote_percent):
        return
    client = _get_owner_client(db, playlist)
    await client.add_tracks(playlist.provider_playlist_id, [suggestion.provider_track_id])
    suggestion = votuna_track_suggestion_crud.update(
        db,
        suggestion,
        {"status": "accepted"},
    )


@router.get("/playlists", response_model=list[VotunaPlaylistOut])
def list_votuna_playlists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List Votuna playlists for the current user."""
    return votuna_playlist_crud.list_for_user(db, current_user.id)


@router.post("/playlists", response_model=VotunaPlaylistDetail)
async def create_votuna_playlist(
    payload: VotunaPlaylistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or enable a Votuna playlist."""
    if not payload.provider_playlist_id and not payload.title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title is required when creating a new provider playlist",
        )

    client = _get_provider_client(payload.provider, current_user)

    if payload.provider_playlist_id:
        existing = votuna_playlist_crud.get_by_provider_playlist_id(
            db, payload.provider, payload.provider_playlist_id
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Playlist already enabled")
        try:
            provider_playlist = await client.get_playlist(payload.provider_playlist_id)
        except ProviderAuthError:
            _raise_provider_auth(current_user)
        except ProviderAPIError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    else:
        try:
            provider_playlist = await client.create_playlist(
                title=payload.title or "Untitled",
                description=payload.description,
                is_public=payload.is_public,
            )
        except ProviderAuthError:
            _raise_provider_auth(current_user)
        except ProviderAPIError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    playlist = votuna_playlist_crud.create(
        db,
        {
            "owner_user_id": current_user.id,
            "provider": provider_playlist.provider,
            "provider_playlist_id": provider_playlist.provider_playlist_id,
            "title": provider_playlist.title,
            "description": provider_playlist.description,
            "image_url": provider_playlist.image_url,
            "is_active": True,
            "last_synced_at": datetime.now(timezone.utc),
        },
    )

    settings = votuna_playlist_settings_crud.create(
        db,
        {
            "playlist_id": playlist.id,
            "required_vote_percent": 60,
            "auto_add_on_threshold": True,
        },
    )

    votuna_playlist_member_crud.create(
        db,
        {
            "playlist_id": playlist.id,
            "user_id": current_user.id,
            "role": "owner",
            "joined_at": datetime.now(timezone.utc),
        },
    )

    return VotunaPlaylistDetail(
        **VotunaPlaylistOut.model_validate(playlist).model_dump(),
        settings=VotunaPlaylistSettingsOut.model_validate(settings),
    )


@router.get("/playlists/{playlist_id}", response_model=VotunaPlaylistDetail)
def get_votuna_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch a Votuna playlist by id."""
    playlist = _get_playlist_or_404(db, playlist_id)
    _require_member(db, playlist_id, current_user.id)
    settings = votuna_playlist_settings_crud.get_by_playlist_id(db, playlist_id)
    return VotunaPlaylistDetail(
        **VotunaPlaylistOut.model_validate(playlist).model_dump(),
        settings=VotunaPlaylistSettingsOut.model_validate(settings) if settings else None,
    )


@router.get("/playlists/{playlist_id}/members", response_model=list[VotunaPlaylistMemberOut])
def list_votuna_members(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List members for a Votuna playlist."""
    _require_member(db, playlist_id, current_user.id)
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


@router.get("/playlists/{playlist_id}/tracks", response_model=list[ProviderTrackOut])
async def list_votuna_tracks(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List provider tracks for the playlist."""
    playlist = _get_playlist_or_404(db, playlist_id)
    _require_member(db, playlist_id, current_user.id)
    client = _get_owner_client(db, playlist)
    try:
        tracks = await client.list_tracks(playlist.provider_playlist_id)
    except ProviderAuthError:
        _raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return [
        ProviderTrackOut(
            provider_track_id=track.provider_track_id,
            title=track.title,
            artist=track.artist,
            artwork_url=track.artwork_url,
            url=track.url,
        )
        for track in tracks
    ]


@router.patch("/playlists/{playlist_id}/settings", response_model=VotunaPlaylistSettingsOut)
def update_votuna_settings(
    playlist_id: int,
    payload: VotunaPlaylistSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update settings for a Votuna playlist."""
    _require_owner(db, playlist_id, current_user.id)
    settings = votuna_playlist_settings_crud.get_by_playlist_id(db, playlist_id)
    if not settings:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Settings not found")
    updated = votuna_playlist_settings_crud.update(db, settings, payload.model_dump(exclude_unset=True))
    return updated


@router.post("/playlists/{playlist_id}/sync", response_model=VotunaPlaylistOut)
async def sync_votuna_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sync playlist metadata from the provider."""
    playlist = _get_playlist_or_404(db, playlist_id)
    _require_member(db, playlist_id, current_user.id)
    client = _get_owner_client(db, playlist)
    try:
        provider_playlist = await client.get_playlist(playlist.provider_playlist_id)
    except ProviderAuthError:
        _raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    updated = votuna_playlist_crud.update(
        db,
        playlist,
        {
            "title": provider_playlist.title,
            "description": provider_playlist.description,
            "image_url": provider_playlist.image_url,
            "last_synced_at": datetime.now(timezone.utc),
        },
    )
    return updated


@router.post("/playlists/{playlist_id}/invites", response_model=VotunaPlaylistInviteOut)
def create_invite(
    playlist_id: int,
    payload: VotunaPlaylistInviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create an invite link for a playlist."""
    _require_owner(db, playlist_id, current_user.id)
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
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
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


@router.get("/playlists/{playlist_id}/suggestions", response_model=list[VotunaTrackSuggestionOut])
def list_suggestions(
    playlist_id: int,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List suggestions for a playlist."""
    _require_member(db, playlist_id, current_user.id)
    suggestions = votuna_track_suggestion_crud.list_for_playlist(db, playlist_id, status)
    return [_serialize_suggestion(db, suggestion) for suggestion in suggestions]


@router.post("/playlists/{playlist_id}/suggestions", response_model=VotunaTrackSuggestionOut)
async def create_suggestion(
    playlist_id: int,
    payload: VotunaTrackSuggestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Suggest a track for a playlist."""
    playlist = _get_playlist_or_404(db, playlist_id)
    _require_member(db, playlist_id, current_user.id)
    client = _get_owner_client(db, playlist)

    try:
        if await client.track_exists(playlist.provider_playlist_id, payload.provider_track_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Track already exists in playlist",
            )
    except ProviderAuthError:
        _raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
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
                await _maybe_auto_add_track(db, playlist, existing)
            except ProviderAuthError:
                _raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
            except ProviderAPIError as exc:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
        return _serialize_suggestion(db, existing)

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
        await _maybe_auto_add_track(db, playlist, suggestion)
    except ProviderAuthError:
        _raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _serialize_suggestion(db, suggestion)


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
    playlist = _get_playlist_or_404(db, suggestion.playlist_id)
    _require_member(db, suggestion.playlist_id, current_user.id)
    if suggestion.status != "pending":
        return _serialize_suggestion(db, suggestion)
    if not votuna_track_vote_crud.has_vote(db, suggestion.id, current_user.id):
        votuna_track_vote_crud.create(
            db,
            {
                "suggestion_id": suggestion.id,
                "user_id": current_user.id,
            },
        )
        try:
            await _maybe_auto_add_track(db, playlist, suggestion)
        except ProviderAuthError:
            _raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
        except ProviderAPIError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _serialize_suggestion(db, suggestion)
