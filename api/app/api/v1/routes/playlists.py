"""Provider playlist routes"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.votuna_playlist import ProviderPlaylistOut, ProviderPlaylistCreate, MusicProvider
from app.services.music_providers import get_music_provider, ProviderAuthError, ProviderAPIError

router = APIRouter()


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


@router.get("/providers/{provider}", response_model=list[ProviderPlaylistOut])
async def list_provider_playlists(
    provider: MusicProvider,
    current_user: User = Depends(get_current_user),
):
    """List playlists from the provider for the current user."""
    client = _get_provider_client(provider, current_user)
    try:
        playlists = await client.list_playlists()
    except ProviderAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return [
        ProviderPlaylistOut(
            provider=playlist.provider,
            provider_playlist_id=playlist.provider_playlist_id,
            title=playlist.title,
            description=playlist.description,
            image_url=playlist.image_url,
            track_count=playlist.track_count,
            is_public=playlist.is_public,
        )
        for playlist in playlists
    ]


@router.post("/providers/{provider}", response_model=ProviderPlaylistOut)
async def create_provider_playlist(
    provider: MusicProvider,
    payload: ProviderPlaylistCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a playlist on the provider."""
    client = _get_provider_client(provider, current_user)
    try:
        playlist = await client.create_playlist(
            title=payload.title,
            description=payload.description,
            is_public=payload.is_public,
        )
    except ProviderAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return ProviderPlaylistOut(
        provider=playlist.provider,
        provider_playlist_id=playlist.provider_playlist_id,
        title=playlist.title,
        description=playlist.description,
        image_url=playlist.image_url,
        track_count=playlist.track_count,
        is_public=playlist.is_public,
    )
