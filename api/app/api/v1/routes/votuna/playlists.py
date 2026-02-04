"""Votuna playlist routes."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.votuna_playlist import VotunaPlaylist
from app.schemas.votuna_playlist import (
    ProviderTrackOut,
    VotunaPlaylistCreate,
    VotunaPlaylistDetail,
    VotunaPlaylistOut,
)
from app.schemas.votuna_playlist_settings import (
    VotunaPlaylistSettingsOut,
    VotunaPlaylistSettingsUpdate,
)
from app.crud.votuna_playlist import votuna_playlist_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud
from app.services.music_providers import ProviderAPIError, ProviderAuthError
from app.api.v1.routes.votuna.common import (
    get_owner_client,
    get_playlist_or_404,
    get_provider_client,
    raise_provider_auth,
    require_member,
    require_owner,
)

router = APIRouter()


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

    client = get_provider_client(payload.provider, current_user)

    if payload.provider_playlist_id:
        existing = votuna_playlist_crud.get_by_provider_playlist_id(
            db, payload.provider, payload.provider_playlist_id
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Playlist already enabled")
        try:
            provider_playlist = await client.get_playlist(payload.provider_playlist_id)
        except ProviderAuthError:
            raise_provider_auth(current_user)
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
            raise_provider_auth(current_user)
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
    playlist = get_playlist_or_404(db, playlist_id)
    require_member(db, playlist_id, current_user.id)
    settings = votuna_playlist_settings_crud.get_by_playlist_id(db, playlist_id)
    return VotunaPlaylistDetail(
        **VotunaPlaylistOut.model_validate(playlist).model_dump(),
        settings=VotunaPlaylistSettingsOut.model_validate(settings) if settings else None,
    )


@router.patch("/playlists/{playlist_id}/settings", response_model=VotunaPlaylistSettingsOut)
def update_votuna_settings(
    playlist_id: int,
    payload: VotunaPlaylistSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update settings for a Votuna playlist."""
    require_owner(db, playlist_id, current_user.id)
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
    playlist = get_playlist_or_404(db, playlist_id)
    require_member(db, playlist_id, current_user.id)
    client = get_owner_client(db, playlist)
    try:
        provider_playlist = await client.get_playlist(playlist.provider_playlist_id)
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
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


@router.get("/playlists/{playlist_id}/tracks", response_model=list[ProviderTrackOut])
async def list_votuna_tracks(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List provider tracks for the playlist."""
    playlist = get_playlist_or_404(db, playlist_id)
    require_member(db, playlist_id, current_user.id)
    client = get_owner_client(db, playlist)
    try:
        tracks = await client.list_tracks(playlist.provider_playlist_id)
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
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
