"""Votuna playlist routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.v1.routes.votuna.common import (
    get_owner_client,
    get_playlist_or_404,
    get_provider_client,
    has_collaborators,
    raise_provider_auth,
    require_member,
    require_owner,
)
from app.auth.dependencies import get_current_user
from app.crud.votuna_playlist import votuna_playlist_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud
from app.crud.votuna_track_addition import votuna_track_addition_crud
from app.db.session import get_db
from app.models.user import User
from app.models.votuna_invites import VotunaPlaylistInvite
from app.models.votuna_members import VotunaPlaylistMember
from app.models.votuna_suggestions import VotunaTrackSuggestion
from app.schemas.votuna_playlist import (
    ProviderTrackAddRequest,
    ProviderTrackOut,
    VotunaPlaylistCreate,
    VotunaPlaylistDetail,
    VotunaPlaylistOut,
    VotunaPlaylistPersonalizeOut,
)
from app.schemas.votuna_playlist_settings import (
    VotunaPlaylistSettingsOut,
    VotunaPlaylistSettingsUpdate,
)
from app.services.music_providers import ProviderAPIError, ProviderAuthError

router = APIRouter()

PERSONAL_SETTINGS_ERROR_CODE = "PERSONAL_PLAYLIST_SETTINGS_DISABLED"
COLLABORATIVE_DIRECT_ADD_ERROR_CODE = "COLLABORATIVE_PLAYLIST_DIRECT_ADD_DISABLED"


def _display_name(user: User) -> str:
    return user.display_name or user.first_name or user.email or user.provider_user_id or f"User {user.id}"


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

    client = get_provider_client(payload.provider, current_user, db=db)

    if payload.provider_playlist_id:
        existing = votuna_playlist_crud.get_by_provider_playlist_id(db, payload.provider, payload.provider_playlist_id)
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
            "tie_break_mode": "add",
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
    playlist = require_owner(db, playlist_id, current_user.id)
    if not has_collaborators(db, playlist):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": PERSONAL_SETTINGS_ERROR_CODE,
                "message": "Voting settings are disabled for personal playlists",
            },
        )
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


@router.post("/playlists/{playlist_id}/tracks", response_model=ProviderTrackOut)
async def add_votuna_track(
    playlist_id: int,
    payload: ProviderTrackAddRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a track directly to a personal playlist (owner only)."""
    playlist = require_owner(db, playlist_id, current_user.id)
    if has_collaborators(db, playlist):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": COLLABORATIVE_DIRECT_ADD_ERROR_CODE,
                "message": "Direct add is disabled for collaborative playlists",
            },
        )

    client = get_owner_client(db, playlist)
    provider_track_id = (payload.provider_track_id or "").strip()
    track_title = payload.track_title
    track_artist = payload.track_artist
    track_artwork_url = payload.track_artwork_url
    track_url = (payload.track_url or "").strip() or None

    if not provider_track_id and not track_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either provider_track_id or track_url is required",
        )

    if track_url and not provider_track_id:
        try:
            resolved_track = await client.resolve_track_url(track_url)
        except ProviderAuthError:
            raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
        except ProviderAPIError as exc:
            if exc.status_code in {400, 404}:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

        provider_track_id = resolved_track.provider_track_id
        track_title = track_title or resolved_track.title
        track_artist = track_artist or resolved_track.artist
        track_artwork_url = track_artwork_url or resolved_track.artwork_url
        track_url = resolved_track.url or track_url

    try:
        if await client.track_exists(playlist.provider_playlist_id, provider_track_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Track already exists in playlist",
            )
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError:
        # If duplicate check fails, continue with add to avoid blocking the owner.
        pass
    except HTTPException:
        raise

    try:
        await client.add_tracks(playlist.provider_playlist_id, [provider_track_id])
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    now = datetime.now(timezone.utc)
    votuna_track_addition_crud.create(
        db,
        {
            "playlist_id": playlist.id,
            "provider_track_id": provider_track_id,
            "source": "personal_add",
            "added_at": now,
            "added_by_user_id": current_user.id,
            "suggestion_id": None,
        },
    )

    return ProviderTrackOut(
        provider_track_id=provider_track_id,
        title=track_title or provider_track_id,
        artist=track_artist,
        artwork_url=track_artwork_url,
        url=track_url,
        added_at=now,
        added_source="personal_add",
        added_by_label="Added directly by You",
        suggested_by_user_id=None,
        suggested_by_display_name=None,
    )


@router.post("/playlists/{playlist_id}/personalize", response_model=VotunaPlaylistPersonalizeOut)
def personalize_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Convert a collaborative playlist back to personal mode."""
    playlist = require_owner(db, playlist_id, current_user.id)
    now = datetime.now(timezone.utc)

    collaborator_rows = (
        db.query(VotunaPlaylistMember)
        .filter(
            VotunaPlaylistMember.playlist_id == playlist_id,
            VotunaPlaylistMember.user_id != playlist.owner_user_id,
        )
        .all()
    )
    for row in collaborator_rows:
        db.delete(row)
    removed_collaborators = len(collaborator_rows)

    invite_rows = (
        db.query(VotunaPlaylistInvite)
        .filter(
            VotunaPlaylistInvite.playlist_id == playlist_id,
            VotunaPlaylistInvite.accepted_at.is_(None),
            VotunaPlaylistInvite.is_revoked.is_(False),
        )
        .all()
    )
    for invite in invite_rows:
        invite.is_revoked = True
    revoked_invites = len(invite_rows)

    pending_suggestions = (
        db.query(VotunaTrackSuggestion)
        .filter(
            VotunaTrackSuggestion.playlist_id == playlist_id,
            VotunaTrackSuggestion.status == "pending",
        )
        .all()
    )
    for suggestion in pending_suggestions:
        suggestion.status = "canceled"
        suggestion.resolved_at = now
        suggestion.resolved_by_user_id = current_user.id
        suggestion.resolution_reason = "canceled_by_owner"
    canceled_suggestions = len(pending_suggestions)

    db.commit()

    return VotunaPlaylistPersonalizeOut(
        playlist_type="personal",
        removed_collaborators=removed_collaborators,
        revoked_invites=revoked_invites,
        canceled_suggestions=canceled_suggestions,
    )


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

    track_ids = [track.provider_track_id for track in tracks if track.provider_track_id]
    latest_additions_by_track = votuna_track_addition_crud.list_latest_for_tracks(
        db,
        playlist_id,
        track_ids,
    )

    suggestion_lookup: dict[str, tuple[int | None, str | None, datetime | None]] = {}
    if track_ids:
        suggestion_rows = (
            db.query(VotunaTrackSuggestion, User)
            .outerjoin(User, User.id == VotunaTrackSuggestion.suggested_by_user_id)
            .filter(
                VotunaTrackSuggestion.playlist_id == playlist_id,
                VotunaTrackSuggestion.status == "accepted",
                VotunaTrackSuggestion.provider_track_id.in_(track_ids),
            )
            .order_by(VotunaTrackSuggestion.updated_at.desc())
            .all()
        )
        for suggestion, suggested_by_user in suggestion_rows:
            if suggestion.provider_track_id in suggestion_lookup:
                continue
            suggested_by_name = (
                "You"
                if suggestion.suggested_by_user_id == current_user.id
                else (_display_name(suggested_by_user) if suggested_by_user else None)
            )
            suggestion_lookup[suggestion.provider_track_id] = (
                suggestion.suggested_by_user_id,
                suggested_by_name,
                suggestion.updated_at,
            )

    addition_suggestion_ids = [
        addition.suggestion_id for addition in latest_additions_by_track.values() if addition.suggestion_id is not None
    ]
    suggestions_by_id: dict[int, VotunaTrackSuggestion] = {}
    if addition_suggestion_ids:
        suggestion_rows = (
            db.query(VotunaTrackSuggestion).filter(VotunaTrackSuggestion.id.in_(addition_suggestion_ids)).all()
        )
        suggestions_by_id = {suggestion.id: suggestion for suggestion in suggestion_rows}

    user_ids: set[int] = set()
    for addition in latest_additions_by_track.values():
        if addition.added_by_user_id is not None:
            user_ids.add(addition.added_by_user_id)
    for suggestion in suggestions_by_id.values():
        if suggestion.suggested_by_user_id is not None:
            user_ids.add(suggestion.suggested_by_user_id)

    users_by_id: dict[int, User] = {}
    if user_ids:
        user_rows = db.query(User).filter(User.id.in_(list(user_ids))).all()
        users_by_id = {user.id: user for user in user_rows}

    payload: list[ProviderTrackOut] = []
    for track in tracks:
        track_id = track.provider_track_id
        legacy_suggestion = suggestion_lookup.get(track_id, (None, None, None))
        suggested_by_user_id = legacy_suggestion[0]
        suggested_by_display_name = legacy_suggestion[1]
        added_at = legacy_suggestion[2]
        added_source = "votuna_suggestion" if legacy_suggestion[2] else "outside_votuna"
        added_by_label = None
        if legacy_suggestion[2]:
            added_by_label = (
                f"Suggested by {legacy_suggestion[1]}"
                if legacy_suggestion[1]
                else (
                    "Suggested by You"
                    if legacy_suggestion[0] == current_user.id
                    else ("Suggested by a former member" if legacy_suggestion[0] else "Suggested via Votuna")
                )
            )
        else:
            added_by_label = "Added outside Votuna"

        addition = latest_additions_by_track.get(track_id)
        if addition:
            added_at = addition.added_at
            if addition.source == "playlist_utils":
                added_source = "playlist_utils"
                suggested_by_user_id = None
                suggested_by_display_name = None
                added_by_label = "Added by playlist utils"
            elif addition.source == "personal_add":
                added_source = "personal_add"
                suggested_by_user_id = None
                suggested_by_display_name = None
                if addition.added_by_user_id == current_user.id:
                    added_by_label = "Added directly by You"
                elif addition.added_by_user_id and addition.added_by_user_id in users_by_id:
                    added_by_label = f"Added directly by {_display_name(users_by_id[addition.added_by_user_id])}"
                else:
                    added_by_label = "Added directly"
            elif addition.source == "suggestion":
                added_source = "votuna_suggestion"
                suggestion = (
                    suggestions_by_id.get(addition.suggestion_id) if addition.suggestion_id is not None else None
                )
                if suggestion:
                    suggested_by_user_id = suggestion.suggested_by_user_id
                    suggested_by_display_name = (
                        "You"
                        if suggestion.suggested_by_user_id == current_user.id
                        else (
                            _display_name(users_by_id[suggestion.suggested_by_user_id])
                            if suggestion.suggested_by_user_id in users_by_id
                            else None
                        )
                    )
                added_by_label = (
                    f"Suggested by {suggested_by_display_name}"
                    if suggested_by_display_name
                    else (
                        "Suggested by You"
                        if suggested_by_user_id == current_user.id
                        else ("Suggested by a former member" if suggested_by_user_id else "Suggested via Votuna")
                    )
                )

        payload.append(
            ProviderTrackOut(
                provider_track_id=track.provider_track_id,
                title=track.title,
                artist=track.artist,
                genre=track.genre,
                artwork_url=track.artwork_url,
                url=track.url,
                added_at=added_at,
                added_source=added_source,  # type: ignore[arg-type]
                added_by_label=added_by_label,
                suggested_by_user_id=suggested_by_user_id,
                suggested_by_display_name=suggested_by_display_name,
            )
        )
    return payload


@router.delete("/playlists/{playlist_id}/tracks/{provider_track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_votuna_track(
    playlist_id: int,
    provider_track_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a track from the provider playlist (owner only)."""
    playlist = require_owner(db, playlist_id, current_user.id)
    client = get_owner_client(db, playlist)
    track_id = provider_track_id.strip()
    if not track_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Track id is required")
    try:
        await client.remove_tracks(playlist.provider_playlist_id, [track_id])
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
