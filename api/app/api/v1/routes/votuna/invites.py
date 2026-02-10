"""Votuna invite routes."""

from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from typing import Annotated, cast
from urllib.parse import quote

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app.api.v1.routes.votuna.common import get_owner_client, raise_provider_auth, require_owner
from app.auth.dependencies import get_current_user, get_optional_current_user
from app.auth.sso import AuthProvider
from app.config.settings import settings
from app.crud.user import user_crud
from app.crud.votuna_playlist import votuna_playlist_crud
from app.crud.votuna_playlist_invite import votuna_playlist_invite_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.db.session import get_db
from app.models.user import User
from app.models.votuna_playlist import VotunaPlaylist
from app.schemas.votuna_invite import (
    VotunaInviteCandidateOut,
    VotunaPendingInviteOut,
    VotunaPlaylistInviteCreate,
    VotunaPlaylistInviteCreateLink,
    VotunaPlaylistInviteCreateUser,
    VotunaPlaylistInviteOut,
)
from app.schemas.votuna_playlist import MusicProvider, VotunaPlaylistOut
from app.services.music_providers import ProviderAPIError, ProviderAuthError
from app.services.votuna_invites import (
    ensure_invite_is_active,
    ensure_targeted_invite_matches_user,
    join_invite,
    join_invite_by_token,
)

router = APIRouter()

DEFAULT_LINK_EXPIRES_HOURS = 24 * 7
DEFAULT_LINK_MAX_USES = 1


def _build_invite_url(request: Request, token: str) -> str:
    base_url = str(request.base_url).rstrip("/")
    return f"{base_url}/api/v1/votuna/invites/{token}/open"


def _build_candidate_profile_url(
    provider: str,
    provider_user_id: str,
    username: str | None = None,
) -> str | None:
    user_id = provider_user_id.strip()
    if not user_id:
        return None
    if provider == "soundcloud":
        handle = (username or "").strip()
        if handle:
            return f"https://soundcloud.com/{quote(handle, safe='')}"
        return f"https://soundcloud.com/users/{quote(user_id, safe='')}"
    return None


def _to_invite_out(
    invite,
    invite_url: str | None = None,
    target_display_name: str | None = None,
    target_username: str | None = None,
    target_avatar_url: str | None = None,
    target_profile_url: str | None = None,
) -> VotunaPlaylistInviteOut:
    payload = VotunaPlaylistInviteOut.model_validate(invite)
    payload.invite_url = invite_url
    payload.target_display_name = target_display_name
    payload.target_username = target_username
    payload.target_avatar_url = target_avatar_url
    payload.target_profile_url = target_profile_url
    return payload


def _display_name(user: User | None) -> str | None:
    if not user:
        return None
    return user.display_name or user.first_name or user.email or user.provider_user_id or f"User {user.id}"


def _user_permalink_url(user: User | None) -> str | None:
    if not user:
        return None
    permalink_url = (user.permalink_url or "").strip()
    return permalink_url or None


def _get_targeted_invite_or_404(db: Session, invite_id: int):
    invite = votuna_playlist_invite_crud.get(db, invite_id)
    if not invite or invite.invite_type != "user":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")
    return invite


@router.get(
    "/playlists/{playlist_id}/invites/candidates",
    response_model=list[VotunaInviteCandidateOut],
)
async def list_invite_candidates(
    playlist_id: int,
    q: str = Query(..., min_length=1),
    limit: int = Query(default=10, ge=1, le=25),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search invite candidates: registered users first, then provider users fallback."""
    playlist = require_owner(db, playlist_id, current_user.id)
    member_ids = {member.user_id for member, _ in votuna_playlist_member_crud.list_members(db, playlist_id)}

    local_candidates = user_crud.search_by_provider_identity(
        db=db,
        provider=playlist.provider,
        query=q,
        limit=limit,
        exclude_user_ids=member_ids,
    )
    if local_candidates:
        return [
            VotunaInviteCandidateOut(
                source="registered",
                provider_user_id=user.provider_user_id,
                username=user.provider_user_id,
                display_name=user.display_name or user.first_name or user.email,
                avatar_url=user.avatar_url,
                profile_url=_user_permalink_url(user),
                is_registered=True,
                registered_user_id=user.id,
            )
            for user in local_candidates
            if user.provider_user_id != current_user.provider_user_id
        ]

    client = get_owner_client(db, playlist)
    try:
        provider_users = await client.search_users(q, limit=limit)
    except ProviderAuthError:
        raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
        raise AssertionError("unreachable")
    except ProviderAPIError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    candidates: list[VotunaInviteCandidateOut] = []
    seen_provider_ids: set[str] = set()
    for provider_user in provider_users:
        provider_user_id = provider_user.provider_user_id.strip()
        if not provider_user_id or provider_user_id in seen_provider_ids:
            continue
        seen_provider_ids.add(provider_user_id)
        if provider_user_id == current_user.provider_user_id:
            continue

        registered_user = user_crud.get_by_provider_id(db, playlist.provider, provider_user_id)
        if registered_user and registered_user.id in member_ids:
            continue

        candidates.append(
            VotunaInviteCandidateOut(
                source="provider",
                provider_user_id=provider_user_id,
                username=provider_user.username or provider_user_id,
                display_name=provider_user.display_name or provider_user.username,
                avatar_url=provider_user.avatar_url,
                profile_url=(_user_permalink_url(registered_user) if registered_user else None)
                or provider_user.profile_url
                or _build_candidate_profile_url(
                    playlist.provider,
                    provider_user_id,
                    provider_user.username,
                ),
                is_registered=registered_user is not None,
                registered_user_id=registered_user.id if registered_user else None,
            )
        )
    return candidates


@router.get("/playlists/{playlist_id}/invites", response_model=list[VotunaPlaylistInviteOut])
async def list_playlist_invites(
    playlist_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List active invites for a playlist (owner-only)."""
    playlist = require_owner(db, playlist_id, current_user.id)
    invites = votuna_playlist_invite_crud.list_active_for_playlist(db, playlist_id)

    user_invite_profile: dict[int, tuple[str | None, str | None, str | None, str | None]] = {}
    user_cache: dict[int, User | None] = {}
    user_invites = [invite for invite in invites if invite.invite_type == "user" and invite.target_provider_user_id]

    if user_invites:
        client = None
        try:
            client = get_owner_client(db, playlist)
        except HTTPException:
            client = None

        for invite in user_invites:
            handle = invite.target_username_snapshot or invite.target_provider_user_id
            display_name = None
            avatar_url = None
            target_user = None
            if invite.target_user_id:
                if invite.target_user_id not in user_cache:
                    user_cache[invite.target_user_id] = user_crud.get(db, invite.target_user_id)
                target_user = user_cache[invite.target_user_id]
                if target_user:
                    display_name = _display_name(target_user)
                    avatar_url = target_user.avatar_url
            profile_url = _user_permalink_url(target_user)
            if client and invite.target_provider_user_id:
                try:
                    provider_user = await client.get_user(invite.target_provider_user_id)
                    handle = provider_user.username or handle
                    display_name = provider_user.display_name or handle
                    avatar_url = provider_user.avatar_url
                    if not profile_url:
                        profile_url = provider_user.profile_url or _build_candidate_profile_url(
                            playlist.provider,
                            invite.target_provider_user_id,
                            provider_user.username,
                        )
                except (ProviderAuthError, ProviderAPIError, Exception):
                    pass
            if not display_name:
                display_name = handle or "Invited user"
            user_invite_profile[invite.id] = (display_name, handle, avatar_url, profile_url)

    payloads: list[VotunaPlaylistInviteOut] = []
    for invite in invites:
        target_display_name = None
        target_username = None
        target_avatar_url = None
        target_profile_url = None
        if invite.id in user_invite_profile:
            target_display_name, target_username, target_avatar_url, target_profile_url = user_invite_profile[invite.id]
        payloads.append(
            _to_invite_out(
                invite,
                invite_url=_build_invite_url(request, invite.token) if invite.invite_type == "link" else None,
                target_display_name=target_display_name,
                target_username=target_username,
                target_avatar_url=target_avatar_url,
                target_profile_url=target_profile_url,
            )
        )
    return payloads


@router.get("/invites/pending", response_model=list[VotunaPendingInviteOut])
def list_pending_invites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List actionable targeted invites for the current user."""
    invites = votuna_playlist_invite_crud.list_pending_user_invites_for_identity(
        db=db,
        auth_provider=current_user.auth_provider,
        provider_user_id=current_user.provider_user_id,
        user_id=current_user.id,
    )
    playlist_cache: dict[int, VotunaPlaylist | None] = {}
    owner_cache: dict[int, User | None] = {}
    payload: list[VotunaPendingInviteOut] = []
    for invite in invites:
        try:
            ensure_invite_is_active(invite)
        except HTTPException:
            continue
        if invite.playlist_id not in playlist_cache:
            playlist = votuna_playlist_crud.get(db, invite.playlist_id)
            playlist_cache[invite.playlist_id] = playlist
        playlist = playlist_cache[invite.playlist_id]
        if not playlist:
            continue
        owner_user_id = playlist.owner_user_id
        if owner_user_id not in owner_cache:
            owner = user_crud.get(db, owner_user_id)
            owner_cache[owner_user_id] = owner
        owner = owner_cache[owner_user_id]
        payload.append(
            VotunaPendingInviteOut(
                invite_id=invite.id,
                playlist_id=invite.playlist_id,
                playlist_title=playlist.title,
                playlist_image_url=playlist.image_url,
                playlist_provider=cast(MusicProvider, playlist.provider),
                owner_user_id=owner_user_id,
                owner_display_name=_display_name(owner),
                created_at=invite.created_at,
                expires_at=invite.expires_at,
            )
        )
    return payload


@router.delete("/playlists/{playlist_id}/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_playlist_invite(
    playlist_id: int,
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a pending invite (owner-only)."""
    require_owner(db, playlist_id, current_user.id)
    invite = votuna_playlist_invite_crud.get(db, invite_id)
    if not invite or invite.playlist_id != playlist_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    if not invite.is_revoked and invite.accepted_at is None:
        votuna_playlist_invite_crud.update(
            db,
            invite,
            {
                "is_revoked": True,
            },
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/playlists/{playlist_id}/invites", response_model=VotunaPlaylistInviteOut)
async def create_invite(
    playlist_id: int,
    payload: Annotated[VotunaPlaylistInviteCreate, Body(discriminator="kind")],
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create either a targeted user invite or a shareable invite link."""
    playlist = require_owner(db, playlist_id, current_user.id)

    if isinstance(payload, VotunaPlaylistInviteCreateUser):
        target_provider_user_id = payload.target_provider_user_id.strip()
        if not target_provider_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_provider_user_id is required",
            )
        if current_user.auth_provider == playlist.provider and current_user.provider_user_id == target_provider_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot invite yourself",
            )

        existing_invite = votuna_playlist_invite_crud.get_active_user_invite(
            db=db,
            playlist_id=playlist_id,
            auth_provider=playlist.provider,
            provider_user_id=target_provider_user_id,
        )
        if existing_invite:
            try:
                ensure_invite_is_active(existing_invite)
                target_user = (
                    user_crud.get(db, existing_invite.target_user_id) if existing_invite.target_user_id else None
                )
                return _to_invite_out(
                    existing_invite,
                    target_profile_url=_user_permalink_url(target_user)
                    or _build_candidate_profile_url(
                        playlist.provider,
                        existing_invite.target_provider_user_id or "",
                        existing_invite.target_username_snapshot,
                    ),
                )
            except HTTPException:
                # If stale, continue and create a fresh invite.
                pass

        client = get_owner_client(db, playlist)
        try:
            provider_user = await client.get_user(target_provider_user_id)
        except ProviderAuthError:
            raise_provider_auth(current_user, owner_id=playlist.owner_user_id)
            raise AssertionError("unreachable")
        except ProviderAPIError as exc:
            if exc.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Target user not found in provider",
                ) from exc
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

        registered_target = user_crud.get_by_provider_id(
            db,
            playlist.provider,
            target_provider_user_id,
        )
        if registered_target and votuna_playlist_member_crud.get_member(
            db,
            playlist_id,
            registered_target.id,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a collaborator",
            )

        invite = votuna_playlist_invite_crud.create(
            db,
            {
                "playlist_id": playlist_id,
                "invite_type": "user",
                "token": token_urlsafe(16),
                "expires_at": datetime.now(timezone.utc) + timedelta(hours=DEFAULT_LINK_EXPIRES_HOURS),
                "max_uses": 1,
                "uses_count": 0,
                "is_revoked": False,
                "created_by_user_id": current_user.id,
                "target_auth_provider": playlist.provider,
                "target_provider_user_id": target_provider_user_id,
                "target_username_snapshot": (
                    provider_user.username or provider_user.display_name or target_provider_user_id
                ),
                "target_user_id": registered_target.id if registered_target else None,
                "accepted_by_user_id": None,
                "accepted_at": None,
            },
        )
        return _to_invite_out(
            invite,
            target_display_name=provider_user.display_name or provider_user.username or target_provider_user_id,
            target_username=provider_user.username or target_provider_user_id,
            target_avatar_url=provider_user.avatar_url,
            target_profile_url=_user_permalink_url(registered_target)
            or provider_user.profile_url
            or _build_candidate_profile_url(
                playlist.provider,
                target_provider_user_id,
                provider_user.username,
            ),
        )

    payload = payload if isinstance(payload, VotunaPlaylistInviteCreateLink) else VotunaPlaylistInviteCreateLink()
    expires_in_hours = payload.expires_in_hours or DEFAULT_LINK_EXPIRES_HOURS
    max_uses = payload.max_uses if payload.max_uses is not None else DEFAULT_LINK_MAX_USES
    invite = votuna_playlist_invite_crud.create(
        db,
        {
            "playlist_id": playlist_id,
            "invite_type": "link",
            "token": token_urlsafe(16),
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=expires_in_hours),
            "max_uses": max_uses,
            "uses_count": 0,
            "is_revoked": False,
            "created_by_user_id": current_user.id,
            "target_auth_provider": None,
            "target_provider_user_id": None,
            "target_username_snapshot": None,
            "target_user_id": None,
            "accepted_by_user_id": None,
            "accepted_at": None,
        },
    )
    return _to_invite_out(invite, invite_url=_build_invite_url(request, invite.token))


@router.post("/invites/{invite_id}/accept", response_model=VotunaPlaylistOut)
def accept_pending_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept one pending targeted invite and join the playlist."""
    invite = _get_targeted_invite_or_404(db, invite_id)
    return join_invite(db, invite, current_user)


@router.post("/invites/{invite_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
def decline_pending_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Decline one pending targeted invite."""
    invite = _get_targeted_invite_or_404(db, invite_id)
    ensure_targeted_invite_matches_user(invite, current_user)
    if invite.accepted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite already accepted")
    ensure_invite_is_active(invite)
    votuna_playlist_invite_crud.update(db, invite, {"is_revoked": True})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/invites/{token}/open")
def open_invite_link(
    token: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    """Open an invite link and redirect through login when needed."""
    invite = votuna_playlist_invite_crud.get_by_token(db, token)
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")
    ensure_invite_is_active(invite)

    playlist = votuna_playlist_crud.get(db, invite.playlist_id)
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found")

    if current_user:
        try:
            joined_playlist = join_invite(db, invite, current_user)
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL.rstrip('/')}/playlists/{joined_playlist.id}",
                status_code=status.HTTP_302_FOUND,
            )
        except HTTPException as exc:
            encoded_error = quote(str(exc.detail))
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL.rstrip('/')}/?invite_error={encoded_error}",
                status_code=status.HTTP_302_FOUND,
            )

    try:
        auth_provider = AuthProvider(playlist.provider)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported login provider: {playlist.provider}",
        ) from exc

    next_path = f"/playlists/{playlist.id}"
    login_url = (
        f"/api/v1/auth/login/{auth_provider.value}?invite_token={quote(token)}&next={quote(next_path, safe='/')}"
    )
    return RedirectResponse(url=login_url, status_code=status.HTTP_302_FOUND)


@router.post("/invites/{token}/join", response_model=VotunaPlaylistOut)
def join_with_invite(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Join a playlist using an invite token."""
    return join_invite_by_token(db, token, current_user)
