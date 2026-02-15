"""Provider playlist routes"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.votuna_playlist import ProviderPlaylistOut, ProviderPlaylistCreate, MusicProvider
from app.services.music_providers import (
    MusicProviderClient,
    ProviderAuthError,
    ProviderAPIError,
    get_provider_client_for_user,
)

router = APIRouter()


def _get_provider_client(provider: str, user: User, db: Session) -> MusicProviderClient:
    if not user.access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing provider access token",
        )
    try:
        return get_provider_client_for_user(provider, user, db=db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


def _raise_provider_api_error(exc: ProviderAPIError) -> None:
    if exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


def _to_provider_playlist_out(playlist) -> ProviderPlaylistOut:
    return ProviderPlaylistOut(
        provider=playlist.provider,
        provider_playlist_id=playlist.provider_playlist_id,
        title=playlist.title,
        description=playlist.description,
        image_url=playlist.image_url,
        url=playlist.url,
        track_count=playlist.track_count,
        is_public=playlist.is_public,
    )


@router.get("/providers/{provider}", response_model=list[ProviderPlaylistOut])
async def list_provider_playlists(
    provider: MusicProvider,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List playlists from the provider for the current user."""
    client = _get_provider_client(provider, current_user, db)
    try:
        playlists = await client.list_playlists()
    except ProviderAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except ProviderAPIError as exc:
        _raise_provider_api_error(exc)
        raise AssertionError("unreachable")
    return [_to_provider_playlist_out(playlist) for playlist in playlists]


@router.get("/providers/{provider}/search", response_model=list[ProviderPlaylistOut])
async def search_provider_playlists(
    provider: MusicProvider,
    q: str = Query(..., min_length=1),
    limit: int = Query(12, ge=1, le=25),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search provider playlists by text."""
    client = _get_provider_client(provider, current_user, db)
    try:
        playlists = await client.search_playlists(q, limit=limit)
    except ProviderAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except ProviderAPIError as exc:
        _raise_provider_api_error(exc)
        raise AssertionError("unreachable")
    return [_to_provider_playlist_out(playlist) for playlist in playlists]


@router.get("/providers/{provider}/resolve", response_model=ProviderPlaylistOut)
async def resolve_provider_playlist(
    provider: MusicProvider,
    url: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve a provider playlist URL into playlist metadata."""
    client = _get_provider_client(provider, current_user, db)
    try:
        playlist = await client.resolve_playlist_url(url)
    except ProviderAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except ProviderAPIError as exc:
        status_code = status.HTTP_400_BAD_REQUEST if exc.status_code in {400, 404} else status.HTTP_502_BAD_GATEWAY
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    return _to_provider_playlist_out(playlist)


@router.post("/providers/{provider}", response_model=ProviderPlaylistOut)
async def create_provider_playlist(
    provider: MusicProvider,
    payload: ProviderPlaylistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a playlist on the provider."""
    client = _get_provider_client(provider, current_user, db)
    try:
        playlist = await client.create_playlist(
            title=payload.title,
            description=payload.description,
            is_public=payload.is_public,
        )
    except ProviderAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except ProviderAPIError as exc:
        _raise_provider_api_error(exc)
        raise AssertionError("unreachable")
    return _to_provider_playlist_out(playlist)
