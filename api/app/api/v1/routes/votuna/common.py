"""Shared helpers for Votuna routes."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.votuna_playlist import VotunaPlaylist
from app.crud.user import user_crud
from app.crud.votuna_playlist import votuna_playlist_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.services.music_providers import MusicProviderClient, ProviderAPIError, get_provider_client_for_user


def get_playlist_or_404(db: Session, playlist_id: int) -> VotunaPlaylist:
    playlist = votuna_playlist_crud.get(db, playlist_id)
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found")
    return playlist


def require_member(db: Session, playlist_id: int, user_id: int):
    member = votuna_playlist_member_crud.get_member(db, playlist_id, user_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a playlist member")
    return member


def require_owner(db: Session, playlist_id: int, user_id: int) -> VotunaPlaylist:
    playlist = get_playlist_or_404(db, playlist_id)
    if playlist.owner_user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not playlist owner")
    return playlist


def has_collaborators(db: Session, playlist: VotunaPlaylist) -> bool:
    """Return whether the playlist has any non-owner collaborators."""
    return votuna_playlist_member_crud.has_non_owner_members(
        db,
        playlist.id,
        playlist.owner_user_id,
    )


def get_provider_client(provider: str, user: User, db: Session | None = None) -> MusicProviderClient:
    if not user.access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing provider access token",
        )
    try:
        return get_provider_client_for_user(provider, user, db=db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


def get_owner_client(db: Session, playlist: VotunaPlaylist) -> MusicProviderClient:
    owner = user_crud.get(db, playlist.owner_user_id)
    if not owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist owner not found")
    return get_provider_client(playlist.provider, owner, db=db)


def _provider_display_name(provider: str | None) -> str:
    normalized = (provider or "").strip().lower()
    if normalized == "soundcloud":
        return "SoundCloud"
    if normalized == "spotify":
        return "Spotify"
    if normalized == "apple":
        return "Apple Music"
    if normalized == "tidal":
        return "TIDAL"
    return "provider"


def raise_provider_auth(
    current_user: User,
    owner_id: int | None = None,
    provider: str | None = None,
) -> None:
    """Raise an auth error, logging out owner or warning members."""
    provider_name = _provider_display_name(provider)
    if owner_id is None or current_user.id == owner_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"{provider_name} authorization expired or invalid",
        )
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"Playlist owner must reconnect {provider_name}",
    )


def raise_provider_api_error(exc: ProviderAPIError) -> None:
    if exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
