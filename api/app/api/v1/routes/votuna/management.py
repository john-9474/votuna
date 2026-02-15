"""Playlist management routes for import/export workflows."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.routes.votuna.common import (
    get_owner_client,
    get_playlist_or_404,
    raise_provider_auth,
    raise_provider_api_error,
    require_owner,
)
from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.votuna_playlist import VotunaPlaylist
from app.crud.votuna_track_addition import votuna_track_addition_crud
from app.schemas.votuna_playlist import MusicProvider, ProviderTrackOut
from app.schemas.votuna_playlist_management import (
    ManagementFacetCount,
    ManagementFacetsRequest,
    ManagementFacetsResponse,
    ManagementDestinationCreate,
    ManagementExecuteResponse,
    ManagementFailedItem,
    ManagementPlaylistRef,
    ManagementPlaylistSummary,
    ManagementPreviewResponse,
    ManagementSelectionMode,
    ManagementSourceTracksRequest,
    ManagementSourceTracksResponse,
    ManagementTransferRequest,
)
from app.services.music_providers import MusicProviderClient, ProviderAPIError, ProviderAuthError, ProviderTrack

router = APIRouter()

MAX_TRACKS_PER_ACTION = 500
ADD_CHUNK_SIZE = 100
FACETS_LIMIT = 100


@dataclass
class ResolvedProviderPlaylist:
    provider: MusicProvider
    provider_playlist_id: str
    title: str

    def to_summary(self) -> ManagementPlaylistSummary:
        return ManagementPlaylistSummary(
            provider=self.provider,
            provider_playlist_id=self.provider_playlist_id,
            title=self.title,
        )


def _normalize(value: str) -> str:
    return value.strip().lower()


def _sanitize_selection_values(values: Sequence[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = _normalize(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        cleaned.append(normalized)
    return cleaned


def _validate_transfer_payload(payload: ManagementTransferRequest, cleaned_values: list[str]) -> None:
    if payload.direction == "import_to_current":
        if payload.counterparty is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="counterparty is required for import_to_current",
            )
        if payload.destination_create is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="destination_create is not allowed for import_to_current",
            )
    else:
        has_counterparty = payload.counterparty is not None
        has_destination_create = payload.destination_create is not None
        if has_counterparty == has_destination_create:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="export_from_current requires exactly one of counterparty or destination_create",
            )

    if payload.selection_mode == "all":
        if cleaned_values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="selection_values must be empty when selection_mode is 'all'",
            )
    elif not cleaned_values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="selection_values is required for selection_mode genre, artist, or songs",
        )


def _provider_track_to_out(track: ProviderTrack) -> ProviderTrackOut:
    return ProviderTrackOut(
        provider_track_id=track.provider_track_id,
        title=track.title,
        artist=track.artist,
        genre=track.genre,
        artwork_url=track.artwork_url,
        url=track.url,
    )


def _contains_search(track: ProviderTrack, needle: str) -> bool:
    if not needle:
        return True
    title = (track.title or "").lower()
    artist = (track.artist or "").lower()
    genre = (track.genre or "").lower()
    return needle in title or needle in artist or needle in genre


def _build_facet_counts(values: Iterable[str | None]) -> list[ManagementFacetCount]:
    counts: dict[str, int] = {}
    display_values: dict[str, str] = {}

    for raw_value in values:
        if raw_value is None:
            continue
        value = raw_value.strip()
        if not value:
            continue
        normalized = _normalize(value)
        counts[normalized] = counts.get(normalized, 0) + 1
        if normalized not in display_values:
            display_values[normalized] = value

    facets = [ManagementFacetCount(value=display_values[key], count=counts[key]) for key in counts]
    facets.sort(key=lambda facet: (-facet.count, facet.value.lower(), facet.value))
    return facets[:FACETS_LIMIT]


def _filter_tracks_by_selection(
    tracks: Sequence[ProviderTrack],
    selection_mode: ManagementSelectionMode,
    cleaned_values: list[str],
) -> list[ProviderTrack]:
    if selection_mode == "all":
        return list(tracks)
    if selection_mode == "songs":
        selected_ids = set(cleaned_values)
        return [track for track in tracks if _normalize(track.provider_track_id) in selected_ids]
    if selection_mode == "artist":
        selected_artists = set(cleaned_values)
        return [track for track in tracks if track.artist and _normalize(track.artist) in selected_artists]
    # selection_mode == "genre"
    selected_genres = set(cleaned_values)
    return [track for track in tracks if track.genre and _normalize(track.genre) in selected_genres]


def _dedupe_tracks_by_id(tracks: Sequence[ProviderTrack]) -> list[ProviderTrack]:
    deduped: list[ProviderTrack] = []
    seen: set[str] = set()
    for track in tracks:
        track_id = track.provider_track_id
        if not track_id or track_id in seen:
            continue
        seen.add(track_id)
        deduped.append(track)
    return deduped


def _chunks(values: Sequence[str], chunk_size: int) -> Iterable[list[str]]:
    for index in range(0, len(values), chunk_size):
        yield list(values[index : index + chunk_size])


async def _safe_get_playlist(
    *,
    client: MusicProviderClient,
    provider_playlist_id: str,
    current_user: User,
    owner_id: int,
    provider: str,
) -> ResolvedProviderPlaylist:
    try:
        provider_playlist = await client.get_playlist(provider_playlist_id)
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=owner_id, provider=provider)
        raise AssertionError("unreachable")
    except ProviderAPIError as exc:
        raise_provider_api_error(exc)
        raise AssertionError("unreachable")
    return ResolvedProviderPlaylist(
        provider=provider_playlist.provider,  # type: ignore[arg-type]
        provider_playlist_id=provider_playlist.provider_playlist_id,
        title=provider_playlist.title,
    )


async def _safe_list_tracks(
    *,
    client: MusicProviderClient,
    provider_playlist_id: str,
    current_user: User,
    owner_id: int,
    provider: str,
) -> list[ProviderTrack]:
    try:
        tracks = await client.list_tracks(provider_playlist_id)
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=owner_id, provider=provider)
        raise AssertionError("unreachable")
    except ProviderAPIError as exc:
        raise_provider_api_error(exc)
        raise AssertionError("unreachable")
    return list(tracks)


async def _resolve_playlist_ref(
    *,
    db: Session,
    current_playlist: VotunaPlaylist,
    current_user: User,
    client: MusicProviderClient,
    ref: ManagementPlaylistRef,
) -> ResolvedProviderPlaylist:
    if ref.kind == "provider":
        if ref.provider != current_playlist.provider:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cross-provider operations are not supported",
            )
        resolved = await _safe_get_playlist(
            client=client,
            provider_playlist_id=ref.provider_playlist_id,
            current_user=current_user,
            owner_id=current_playlist.owner_user_id,
            provider=current_playlist.provider,
        )
        return ResolvedProviderPlaylist(
            provider=current_playlist.provider,  # type: ignore[arg-type]
            provider_playlist_id=resolved.provider_playlist_id,
            title=resolved.title,
        )

    other_playlist = get_playlist_or_404(db, ref.votuna_playlist_id)
    if other_playlist.owner_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner-owned Votuna playlists can be used for transfers",
        )
    if other_playlist.provider != current_playlist.provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cross-provider operations are not supported",
        )
    resolved = await _safe_get_playlist(
        client=client,
        provider_playlist_id=other_playlist.provider_playlist_id,
        current_user=current_user,
        owner_id=current_playlist.owner_user_id,
        provider=current_playlist.provider,
    )
    return ResolvedProviderPlaylist(
        provider=other_playlist.provider,  # type: ignore[arg-type]
        provider_playlist_id=other_playlist.provider_playlist_id,
        title=resolved.title or other_playlist.title,
    )


def _build_preview_destination_for_create(
    *,
    current_playlist: VotunaPlaylist,
    destination_create: ManagementDestinationCreate,
) -> ResolvedProviderPlaylist:
    return ResolvedProviderPlaylist(
        provider=current_playlist.provider,  # type: ignore[arg-type]
        provider_playlist_id="(new)",
        title=destination_create.title,
    )


async def _resolve_transfer_endpoints(
    *,
    db: Session,
    current_playlist: VotunaPlaylist,
    current_user: User,
    client: MusicProviderClient,
    payload: ManagementTransferRequest,
) -> tuple[ResolvedProviderPlaylist, ResolvedProviderPlaylist, bool]:
    current_summary = ResolvedProviderPlaylist(
        provider=current_playlist.provider,  # type: ignore[arg-type]
        provider_playlist_id=current_playlist.provider_playlist_id,
        title=current_playlist.title,
    )

    if payload.direction == "import_to_current":
        assert payload.counterparty is not None
        source = await _resolve_playlist_ref(
            db=db,
            current_playlist=current_playlist,
            current_user=current_user,
            client=client,
            ref=payload.counterparty,
        )
        destination = current_summary
        destination_is_created = False
    else:
        source = current_summary
        if payload.counterparty is not None:
            destination = await _resolve_playlist_ref(
                db=db,
                current_playlist=current_playlist,
                current_user=current_user,
                client=client,
                ref=payload.counterparty,
            )
            destination_is_created = False
        else:
            assert payload.destination_create is not None
            destination = _build_preview_destination_for_create(
                current_playlist=current_playlist,
                destination_create=payload.destination_create,
            )
            destination_is_created = True

    if not destination_is_created and source.provider_playlist_id == destination.provider_playlist_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination cannot be the same playlist",
        )

    return source, destination, destination_is_created


@router.post(
    "/playlists/{playlist_id}/management/source-tracks",
    response_model=ManagementSourceTracksResponse,
)
async def list_management_source_tracks(
    playlist_id: int,
    payload: ManagementSourceTracksRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List source playlist tracks for transfer picking."""
    current_playlist = require_owner(db, playlist_id, current_user.id)
    client = get_owner_client(db, current_playlist)
    source = await _resolve_playlist_ref(
        db=db,
        current_playlist=current_playlist,
        current_user=current_user,
        client=client,
        ref=payload.source,
    )
    tracks = await _safe_list_tracks(
        client=client,
        provider_playlist_id=source.provider_playlist_id,
        current_user=current_user,
        owner_id=current_playlist.owner_user_id,
        provider=current_playlist.provider,
    )
    needle = _normalize(payload.search or "")
    filtered_tracks = [track for track in tracks if _contains_search(track, needle)]
    paged_tracks = filtered_tracks[payload.offset : payload.offset + payload.limit]
    return ManagementSourceTracksResponse(
        tracks=[_provider_track_to_out(track) for track in paged_tracks],
        total_count=len(filtered_tracks),
        limit=payload.limit,
        offset=payload.offset,
    )


@router.post(
    "/playlists/{playlist_id}/management/facets",
    response_model=ManagementFacetsResponse,
)
async def list_management_facets(
    playlist_id: int,
    payload: ManagementFacetsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List aggregated source facets for genre and artist suggestions."""
    current_playlist = require_owner(db, playlist_id, current_user.id)
    client = get_owner_client(db, current_playlist)
    source = await _resolve_playlist_ref(
        db=db,
        current_playlist=current_playlist,
        current_user=current_user,
        client=client,
        ref=payload.source,
    )
    tracks = await _safe_list_tracks(
        client=client,
        provider_playlist_id=source.provider_playlist_id,
        current_user=current_user,
        owner_id=current_playlist.owner_user_id,
        provider=current_playlist.provider,
    )

    return ManagementFacetsResponse(
        genres=_build_facet_counts(track.genre for track in tracks),
        artists=_build_facet_counts(track.artist for track in tracks),
        total_tracks_considered=len(tracks),
    )


@router.post("/playlists/{playlist_id}/management/preview", response_model=ManagementPreviewResponse)
async def preview_management_transfer(
    playlist_id: int,
    payload: ManagementTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Preview a management transfer without mutating provider playlists."""
    current_playlist = require_owner(db, playlist_id, current_user.id)
    cleaned_values = _sanitize_selection_values(payload.selection_values)
    _validate_transfer_payload(payload, cleaned_values)

    client = get_owner_client(db, current_playlist)
    source, destination, destination_is_created = await _resolve_transfer_endpoints(
        db=db,
        current_playlist=current_playlist,
        current_user=current_user,
        client=client,
        payload=payload,
    )

    source_tracks = await _safe_list_tracks(
        client=client,
        provider_playlist_id=source.provider_playlist_id,
        current_user=current_user,
        owner_id=current_playlist.owner_user_id,
        provider=current_playlist.provider,
    )
    matched_tracks = _dedupe_tracks_by_id(
        _filter_tracks_by_selection(source_tracks, payload.selection_mode, cleaned_values)
    )

    destination_track_ids: set[str] = set()
    if not destination_is_created:
        destination_tracks = await _safe_list_tracks(
            client=client,
            provider_playlist_id=destination.provider_playlist_id,
            current_user=current_user,
            owner_id=current_playlist.owner_user_id,
            provider=current_playlist.provider,
        )
        destination_track_ids = {track.provider_track_id for track in destination_tracks if track.provider_track_id}

    duplicate_tracks = [track for track in matched_tracks if track.provider_track_id in destination_track_ids]
    to_add_tracks = [track for track in matched_tracks if track.provider_track_id not in destination_track_ids]

    if len(to_add_tracks) > MAX_TRACKS_PER_ACTION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transfer exceeds max tracks per action ({MAX_TRACKS_PER_ACTION})",
        )

    return ManagementPreviewResponse(
        source=source.to_summary(),
        destination=destination.to_summary(),
        selection_mode=payload.selection_mode,
        selection_values=cleaned_values,
        matched_count=len(matched_tracks),
        to_add_count=len(to_add_tracks),
        duplicate_count=len(duplicate_tracks),
        max_tracks_per_action=MAX_TRACKS_PER_ACTION,
        matched_sample=[_provider_track_to_out(track) for track in matched_tracks],
        duplicate_sample=[_provider_track_to_out(track) for track in duplicate_tracks],
    )


@router.post("/playlists/{playlist_id}/management/execute", response_model=ManagementExecuteResponse)
async def execute_management_transfer(
    playlist_id: int,
    payload: ManagementTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Execute a management transfer against provider playlists."""
    current_playlist = require_owner(db, playlist_id, current_user.id)
    cleaned_values = _sanitize_selection_values(payload.selection_values)
    _validate_transfer_payload(payload, cleaned_values)

    client = get_owner_client(db, current_playlist)
    source, destination_preview, destination_is_created = await _resolve_transfer_endpoints(
        db=db,
        current_playlist=current_playlist,
        current_user=current_user,
        client=client,
        payload=payload,
    )

    source_tracks = await _safe_list_tracks(
        client=client,
        provider_playlist_id=source.provider_playlist_id,
        current_user=current_user,
        owner_id=current_playlist.owner_user_id,
        provider=current_playlist.provider,
    )
    matched_tracks = _dedupe_tracks_by_id(
        _filter_tracks_by_selection(source_tracks, payload.selection_mode, cleaned_values)
    )

    created_destination_summary: ManagementPlaylistSummary | None = None

    if destination_is_created:
        assert payload.destination_create is not None
        try:
            created_destination = await client.create_playlist(
                title=payload.destination_create.title,
                description=payload.destination_create.description,
                is_public=payload.destination_create.is_public,
            )
        except ProviderAuthError:
            raise_provider_auth(
                current_user,
                owner_id=current_playlist.owner_user_id,
                provider=current_playlist.provider,
            )
            raise AssertionError("unreachable")
        except ProviderAPIError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

        destination = ResolvedProviderPlaylist(
            provider=current_playlist.provider,  # type: ignore[arg-type]
            provider_playlist_id=created_destination.provider_playlist_id,
            title=created_destination.title,
        )
        created_destination_summary = destination.to_summary()
        destination_track_ids: set[str] = set()
    else:
        destination = destination_preview
        destination_tracks = await _safe_list_tracks(
            client=client,
            provider_playlist_id=destination.provider_playlist_id,
            current_user=current_user,
            owner_id=current_playlist.owner_user_id,
            provider=current_playlist.provider,
        )
        destination_track_ids = {track.provider_track_id for track in destination_tracks if track.provider_track_id}

    duplicate_tracks = [track for track in matched_tracks if track.provider_track_id in destination_track_ids]
    to_add_track_ids = [
        track.provider_track_id for track in matched_tracks if track.provider_track_id not in destination_track_ids
    ]

    if len(to_add_track_ids) > MAX_TRACKS_PER_ACTION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transfer exceeds max tracks per action ({MAX_TRACKS_PER_ACTION})",
        )

    added_count = 0
    successfully_added_track_ids: list[str] = []
    failed_items: list[ManagementFailedItem] = []

    for chunk in _chunks(to_add_track_ids, ADD_CHUNK_SIZE):
        if not chunk:
            continue
        try:
            await client.add_tracks(destination.provider_playlist_id, chunk)
            added_count += len(chunk)
            successfully_added_track_ids.extend(chunk)
            continue
        except ProviderAuthError:
            raise_provider_auth(
                current_user,
                owner_id=current_playlist.owner_user_id,
                provider=current_playlist.provider,
            )
            raise AssertionError("unreachable")
        except ProviderAPIError:
            # Fall back to per-track retries for best-effort behavior.
            pass

        for track_id in chunk:
            try:
                await client.add_tracks(destination.provider_playlist_id, [track_id])
                added_count += 1
                successfully_added_track_ids.append(track_id)
            except ProviderAuthError:
                raise_provider_auth(
                    current_user,
                    owner_id=current_playlist.owner_user_id,
                    provider=current_playlist.provider,
                )
                raise AssertionError("unreachable")
            except ProviderAPIError as exc:
                failed_items.append(ManagementFailedItem(provider_track_id=track_id, error=str(exc)))
            except Exception as exc:  # pragma: no cover - defensive fallback
                failed_items.append(ManagementFailedItem(provider_track_id=track_id, error=str(exc)))

    if successfully_added_track_ids:
        destination_playlists = (
            db.query(VotunaPlaylist)
            .filter(
                VotunaPlaylist.provider == current_playlist.provider,
                VotunaPlaylist.provider_playlist_id == destination.provider_playlist_id,
            )
            .all()
        )
        added_at = datetime.now(timezone.utc)
        for destination_playlist in destination_playlists:
            for track_id in successfully_added_track_ids:
                votuna_track_addition_crud.create(
                    db,
                    {
                        "playlist_id": destination_playlist.id,
                        "provider_track_id": track_id,
                        "source": "playlist_utils",
                        "added_at": added_at,
                        "added_by_user_id": current_user.id,
                        "suggestion_id": None,
                    },
                )

    return ManagementExecuteResponse(
        source=source.to_summary(),
        destination=destination.to_summary(),
        created_destination=created_destination_summary,
        matched_count=len(matched_tracks),
        added_count=added_count,
        skipped_duplicate_count=len(duplicate_tracks),
        failed_count=len(failed_items),
        failed_items=failed_items,
    )
