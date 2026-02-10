"""Votuna suggestion routes."""

import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.v1.routes.votuna.common import (
    get_owner_client,
    get_playlist_or_404,
    has_collaborators,
    raise_provider_auth,
    require_member,
    require_owner,
)
from app.auth.dependencies import get_current_user
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud
from app.crud.votuna_track_addition import votuna_track_addition_crud
from app.crud.votuna_track_recommendation_decline import (
    votuna_track_recommendation_decline_crud,
)
from app.crud.votuna_track_suggestion import votuna_track_suggestion_crud
from app.crud.votuna_track_vote import votuna_track_vote_crud
from app.db.session import get_db
from app.models.user import User
from app.models.votuna_playlist import VotunaPlaylist
from app.models.votuna_suggestions import VotunaTrackSuggestion
from app.schemas.votuna_playlist import ProviderTrackOut
from app.schemas.votuna_suggestion import (
    VotunaTrackReactionUpdate,
    VotunaTrackRecommendationDeclineCreate,
    VotunaTrackSuggestionCreate,
    VotunaTrackSuggestionOut,
)
from app.services.music_providers import ProviderAPIError, ProviderAuthError
from app.services.music_providers.base import ProviderTrack

router = APIRouter()

REJECTED_TRACK_ERROR_CODE = "TRACK_PREVIOUSLY_REJECTED"
PERSONAL_SUGGESTIONS_ERROR_CODE = "PERSONAL_PLAYLIST_SUGGESTIONS_DISABLED"
RECOMMENDATION_SEED_LIMIT = 8
RECOMMENDATION_RELATED_LIMIT_PER_SEED = 25
RECOMMENDATION_MAX_TRACKS_PER_ARTIST = 2


def _display_name(user: User) -> str:
    return user.display_name or user.first_name or user.email or user.provider_user_id or f"User {user.id}"


def _member_name_by_user_id(db: Session, playlist_id: int) -> dict[int, str]:
    members = votuna_playlist_member_crud.list_members(db, playlist_id)
    return {member.user_id: _display_name(user) for member, user in members}


def _raise_resuggest_conflict() -> None:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": REJECTED_TRACK_ERROR_CODE,
            "message": "Track was previously rejected. Confirm to suggest it again.",
        },
    )


def _ordered_seed_track_ids(
    current_tracks: list[ProviderTrack],
    refresh_nonce: str | None,
) -> list[str]:
    track_ids: list[str] = []
    seen: set[str] = set()
    for track in current_tracks:
        track_id = (track.provider_track_id or "").strip()
        if not track_id or track_id in seen:
            continue
        seen.add(track_id)
        track_ids.append(track_id)
    if not track_ids:
        return []
    if not refresh_nonce:
        return track_ids[:RECOMMENDATION_SEED_LIMIT]
    nonce = refresh_nonce.strip()
    if not nonce:
        return track_ids[:RECOMMENDATION_SEED_LIMIT]
    ranked = sorted(
        track_ids,
        key=lambda track_id: hashlib.sha256(f"{nonce}:{track_id}".encode("utf-8")).hexdigest(),
    )
    return ranked[:RECOMMENDATION_SEED_LIMIT]


def _serialize_provider_track(track: ProviderTrack) -> ProviderTrackOut:
    return ProviderTrackOut(
        provider_track_id=track.provider_track_id,
        title=track.title,
        artist=track.artist,
        genre=track.genre,
        artwork_url=track.artwork_url,
        url=track.url,
    )


def _serialize_suggestion(
    db: Session,
    playlist: VotunaPlaylist,
    suggestion: VotunaTrackSuggestion,
    current_user_id: int,
) -> VotunaTrackSuggestionOut:
    reaction_by_user = votuna_track_vote_crud.get_reaction_by_user(db, suggestion.id)
    member_names = _member_name_by_user_id(db, suggestion.playlist_id)
    filtered_reactions = {
        user_id: reaction for user_id, reaction in reaction_by_user.items() if user_id in member_names
    }
    upvoter_display_names = [
        member_names[user_id] for user_id in member_names if filtered_reactions.get(user_id) == "up"
    ]
    downvoter_display_names = [
        member_names[user_id] for user_id in member_names if filtered_reactions.get(user_id) == "down"
    ]
    collaborators_left_to_vote_names = [
        name for user_id, name in member_names.items() if user_id not in filtered_reactions
    ]
    can_cancel = suggestion.status == "pending" and (
        current_user_id == suggestion.suggested_by_user_id or current_user_id == playlist.owner_user_id
    )
    can_force_add = suggestion.status == "pending" and current_user_id == playlist.owner_user_id
    return VotunaTrackSuggestionOut(
        id=suggestion.id,
        playlist_id=suggestion.playlist_id,
        provider_track_id=suggestion.provider_track_id,
        track_title=suggestion.track_title,
        track_artist=suggestion.track_artist,
        track_artwork_url=suggestion.track_artwork_url,
        track_url=suggestion.track_url,
        suggested_by_user_id=suggestion.suggested_by_user_id,
        status=(suggestion.status),  # type: ignore[arg-type]
        resolution_reason=(suggestion.resolution_reason),  # type: ignore[arg-type]
        resolved_at=suggestion.resolved_at,
        upvote_count=len(upvoter_display_names),
        downvote_count=len(downvoter_display_names),
        my_reaction=reaction_by_user.get(current_user_id),  # type: ignore[arg-type]
        upvoter_display_names=upvoter_display_names,
        downvoter_display_names=downvoter_display_names,
        collaborators_left_to_vote_count=len(collaborators_left_to_vote_names),
        collaborators_left_to_vote_names=collaborators_left_to_vote_names,
        can_cancel=can_cancel,
        can_force_add=can_force_add,
        created_at=suggestion.created_at,
        updated_at=suggestion.updated_at,
    )


def _resolve_without_add(
    db: Session,
    suggestion: VotunaTrackSuggestion,
    *,
    status_value: str,
    resolution_reason: str,
    resolved_by_user_id: int,
) -> VotunaTrackSuggestion:
    now = datetime.now(timezone.utc)
    return votuna_track_suggestion_crud.update(
        db,
        suggestion,
        {
            "status": status_value,
            "resolved_at": now,
            "resolved_by_user_id": resolved_by_user_id,
            "resolution_reason": resolution_reason,
        },
    )


async def _accept_suggestion(
    db: Session,
    playlist: VotunaPlaylist,
    suggestion: VotunaTrackSuggestion,
    *,
    resolution_reason: str,
    resolved_by_user_id: int,
) -> VotunaTrackSuggestion:
    now = datetime.now(timezone.utc)
    client = get_owner_client(db, playlist)
    await client.add_tracks(playlist.provider_playlist_id, [suggestion.provider_track_id])
    accepted = votuna_track_suggestion_crud.update(
        db,
        suggestion,
        {
            "status": "accepted",
            "resolved_at": now,
            "resolved_by_user_id": resolved_by_user_id,
            "resolution_reason": resolution_reason,
        },
    )
    votuna_track_addition_crud.create(
        db,
        {
            "playlist_id": playlist.id,
            "provider_track_id": suggestion.provider_track_id,
            "source": "suggestion",
            "added_at": now,
            "added_by_user_id": resolved_by_user_id,
            "suggestion_id": suggestion.id,
        },
    )
    return accepted


async def _resolve_if_all_collaborators_voted(
    db: Session,
    playlist: VotunaPlaylist,
    suggestion: VotunaTrackSuggestion,
    *,
    actor_user_id: int,
) -> VotunaTrackSuggestion:
    if suggestion.status != "pending":
        return suggestion
    settings = votuna_playlist_settings_crud.get_by_playlist_id(db, playlist.id)
    if not settings:
        return suggestion

    member_rows = votuna_playlist_member_crud.list_members(db, playlist.id)
    eligible_voter_ids = [member.user_id for member, _user in member_rows]
    if not eligible_voter_ids:
        return suggestion

    reactions_by_user = votuna_track_vote_crud.get_reaction_by_user(db, suggestion.id)
    has_all_votes = all(user_id in reactions_by_user for user_id in eligible_voter_ids)
    if not has_all_votes:
        return suggestion

    upvotes = sum(1 for user_id in eligible_voter_ids if reactions_by_user.get(user_id) == "up")
    downvotes = sum(1 for user_id in eligible_voter_ids if reactions_by_user.get(user_id) == "down")

    if upvotes == downvotes:
        if settings.tie_break_mode == "add":
            return await _accept_suggestion(
                db,
                playlist,
                suggestion,
                resolution_reason="tie_add",
                resolved_by_user_id=actor_user_id,
            )
        return _resolve_without_add(
            db,
            suggestion,
            status_value="rejected",
            resolution_reason="tie_reject",
            resolved_by_user_id=actor_user_id,
        )

    upvote_percent = (upvotes / len(eligible_voter_ids)) * 100
    if upvote_percent >= settings.required_vote_percent:
        return await _accept_suggestion(
            db,
            playlist,
            suggestion,
            resolution_reason="threshold_met",
            resolved_by_user_id=actor_user_id,
        )
    return _resolve_without_add(
        db,
        suggestion,
        status_value="rejected",
        resolution_reason="threshold_not_met",
        resolved_by_user_id=actor_user_id,
    )


@router.get("/playlists/{playlist_id}/suggestions", response_model=list[VotunaTrackSuggestionOut])
def list_suggestions(
    playlist_id: int,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List suggestions for a playlist."""
    playlist = get_playlist_or_404(db, playlist_id)
    require_member(db, playlist_id, current_user.id)
    suggestions = votuna_track_suggestion_crud.list_for_playlist(db, playlist_id, status)
    return [_serialize_suggestion(db, playlist, suggestion, current_user.id) for suggestion in suggestions]


@router.get("/playlists/{playlist_id}/tracks/search", response_model=list[ProviderTrackOut])
async def search_tracks_for_suggestions(
    playlist_id: int,
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=25),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search provider tracks to suggest for voting."""
    playlist = get_playlist_or_404(db, playlist_id)
    require_member(db, playlist_id, current_user.id)
    client = get_owner_client(db, playlist)
    query = q.strip()
    if not query:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Search query is required")
    try:
        results = await client.search_tracks(query, limit=limit)
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return [
        ProviderTrackOut(
            provider_track_id=track.provider_track_id,
            title=track.title,
            artist=track.artist,
            genre=track.genre,
            artwork_url=track.artwork_url,
            url=track.url,
        )
        for track in results
    ]


@router.get("/playlists/{playlist_id}/tracks/recommendations", response_model=list[ProviderTrackOut])
async def list_recommended_tracks(
    playlist_id: int,
    limit: int = Query(5, ge=1, le=50),
    offset: int = Query(0, ge=0),
    refresh_nonce: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List personalized track recommendations based on current playlist tracks."""
    playlist = get_playlist_or_404(db, playlist_id)
    require_member(db, playlist_id, current_user.id)
    client = get_owner_client(db, playlist)
    try:
        current_tracks = list(await client.list_tracks(playlist.provider_playlist_id))
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    if not current_tracks:
        return []

    seed_track_ids = _ordered_seed_track_ids(current_tracks, refresh_nonce)
    if not seed_track_ids:
        return []

    existing_track_ids = {
        (track.provider_track_id or "").strip() for track in current_tracks if (track.provider_track_id or "").strip()
    }
    pending_track_ids = {
        suggestion.provider_track_id
        for suggestion in votuna_track_suggestion_crud.list_for_playlist(
            db,
            playlist_id,
            status="pending",
        )
    }
    declined_track_ids = votuna_track_recommendation_decline_crud.list_declined_track_ids(
        db,
        playlist_id=playlist_id,
        user_id=current_user.id,
    )

    score_by_track_id: dict[str, tuple[int, int, ProviderTrack]] = {}
    for seed_index, seed_track_id in enumerate(seed_track_ids):
        try:
            related_tracks = await client.related_tracks(
                seed_track_id,
                limit=RECOMMENDATION_RELATED_LIMIT_PER_SEED,
                offset=0,
            )
        except ProviderAuthError:
            raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
        except ProviderAPIError as exc:
            if exc.status_code in {400, 404}:
                continue
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

        for track in related_tracks:
            track_id = (track.provider_track_id or "").strip()
            if not track_id:
                continue
            existing_entry = score_by_track_id.get(track_id)
            if not existing_entry:
                score_by_track_id[track_id] = (1, seed_index, track)
                continue
            score, first_seed_index, existing_track = existing_entry
            next_first_seed_index = min(seed_index, first_seed_index)
            score_by_track_id[track_id] = (score + 1, next_first_seed_index, existing_track)

    if not score_by_track_id:
        return []

    ranked_entries = sorted(
        score_by_track_id.items(),
        key=lambda entry: (
            -entry[1][0],
            entry[1][1],
            entry[0],
        ),
    )

    filtered_tracks: list[ProviderTrack] = []
    artist_counts: dict[str, int] = {}
    for _track_id, (_score, _first_seed_index, track) in ranked_entries:
        track_id = (track.provider_track_id or "").strip()
        if not track_id:
            continue
        if track_id in existing_track_ids:
            continue
        if track_id in pending_track_ids:
            continue
        if track_id in declined_track_ids:
            continue
        artist_key = (track.artist or "").strip().lower()
        if artist_key:
            current_count = artist_counts.get(artist_key, 0)
            if current_count >= RECOMMENDATION_MAX_TRACKS_PER_ARTIST:
                continue
            artist_counts[artist_key] = current_count + 1
        filtered_tracks.append(track)

    if not filtered_tracks:
        return []

    page = filtered_tracks[offset : offset + limit]
    return [_serialize_provider_track(track) for track in page]


@router.post(
    "/playlists/{playlist_id}/tracks/recommendations/decline",
    status_code=status.HTTP_204_NO_CONTENT,
)
def decline_track_recommendation(
    playlist_id: int,
    payload: VotunaTrackRecommendationDeclineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persist a declined recommendation for one user and playlist."""
    playlist = get_playlist_or_404(db, playlist_id)
    require_member(db, playlist_id, current_user.id)
    provider_track_id = payload.provider_track_id.strip()
    if not provider_track_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="provider_track_id is required")

    votuna_track_recommendation_decline_crud.upsert_decline(
        db,
        playlist_id=playlist.id,
        user_id=current_user.id,
        provider_track_id=provider_track_id,
        declined_at=datetime.now(timezone.utc),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
    if not has_collaborators(db, playlist):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": PERSONAL_SUGGESTIONS_ERROR_CODE,
                "message": "Suggestions are disabled for personal playlists",
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
        # If the provider check fails, proceed with the suggestion to avoid blocking.
        pass
    except HTTPException:
        raise

    existing = votuna_track_suggestion_crud.get_pending_by_track(
        db,
        playlist_id,
        provider_track_id,
    )
    if existing:
        votuna_track_vote_crud.set_reaction(db, existing.id, current_user.id, "up")
        try:
            existing = await _resolve_if_all_collaborators_voted(
                db,
                playlist,
                existing,
                actor_user_id=current_user.id,
            )
        except ProviderAuthError:
            raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
        except ProviderAPIError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
        return _serialize_suggestion(db, playlist, existing, current_user.id)

    if not payload.allow_resuggest:
        latest_rejected = votuna_track_suggestion_crud.get_latest_rejected_by_track(
            db,
            playlist_id,
            provider_track_id,
        )
        if latest_rejected:
            _raise_resuggest_conflict()

    suggestion = votuna_track_suggestion_crud.create(
        db,
        {
            "playlist_id": playlist_id,
            "provider_track_id": provider_track_id,
            "track_title": track_title,
            "track_artist": track_artist,
            "track_artwork_url": track_artwork_url,
            "track_url": track_url,
            "suggested_by_user_id": current_user.id,
            "status": "pending",
        },
    )
    votuna_track_vote_crud.set_reaction(db, suggestion.id, current_user.id, "up")
    try:
        suggestion = await _resolve_if_all_collaborators_voted(
            db,
            playlist,
            suggestion,
            actor_user_id=current_user.id,
        )
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _serialize_suggestion(db, playlist, suggestion, current_user.id)


@router.put("/suggestions/{suggestion_id}/reaction", response_model=VotunaTrackSuggestionOut)
async def set_suggestion_reaction(
    suggestion_id: int,
    payload: VotunaTrackReactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create/update/remove a reaction on a suggestion."""
    suggestion = votuna_track_suggestion_crud.get(db, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")
    playlist = get_playlist_or_404(db, suggestion.playlist_id)
    require_member(db, suggestion.playlist_id, current_user.id)
    if suggestion.status != "pending":
        return _serialize_suggestion(db, playlist, suggestion, current_user.id)

    existing = votuna_track_vote_crud.get_vote(db, suggestion.id, current_user.id)
    if payload.reaction is None:
        if existing:
            votuna_track_vote_crud.clear_reaction(db, suggestion.id, current_user.id)
    elif existing and existing.reaction == payload.reaction:
        votuna_track_vote_crud.clear_reaction(db, suggestion.id, current_user.id)
    else:
        votuna_track_vote_crud.set_reaction(
            db,
            suggestion.id,
            current_user.id,
            payload.reaction,
        )

    try:
        suggestion = await _resolve_if_all_collaborators_voted(
            db,
            playlist,
            suggestion,
            actor_user_id=current_user.id,
        )
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _serialize_suggestion(db, playlist, suggestion, current_user.id)


@router.post("/suggestions/{suggestion_id}/cancel", response_model=VotunaTrackSuggestionOut)
def cancel_suggestion(
    suggestion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a pending suggestion (suggester or owner only)."""
    suggestion = votuna_track_suggestion_crud.get(db, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")
    playlist = get_playlist_or_404(db, suggestion.playlist_id)
    require_member(db, suggestion.playlist_id, current_user.id)
    if suggestion.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending suggestions can be canceled",
        )

    is_owner = current_user.id == playlist.owner_user_id
    is_suggester = current_user.id == suggestion.suggested_by_user_id
    if not (is_owner or is_suggester):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the suggester or playlist owner can cancel this suggestion",
        )

    reason = "canceled_by_suggester" if is_suggester else "canceled_by_owner"
    suggestion = _resolve_without_add(
        db,
        suggestion,
        status_value="canceled",
        resolution_reason=reason,
        resolved_by_user_id=current_user.id,
    )
    return _serialize_suggestion(db, playlist, suggestion, current_user.id)


@router.post("/suggestions/{suggestion_id}/force-add", response_model=VotunaTrackSuggestionOut)
async def force_add_suggestion(
    suggestion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Force-add a pending suggestion (playlist owner only)."""
    suggestion = votuna_track_suggestion_crud.get(db, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")
    playlist = require_owner(db, suggestion.playlist_id, current_user.id)
    if suggestion.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending suggestions can be force-added",
        )

    try:
        suggestion = await _accept_suggestion(
            db,
            playlist,
            suggestion,
            resolution_reason="force_add",
            resolved_by_user_id=current_user.id,
        )
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _serialize_suggestion(db, playlist, suggestion, current_user.id)
