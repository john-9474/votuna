from datetime import datetime, timedelta, timezone
import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.crud.user import user_crud
from app.crud.votuna_playlist import votuna_playlist_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_track_suggestion import votuna_track_suggestion_crud
from app.crud.votuna_track_vote import votuna_track_vote_crud
from app.models.votuna_votes import VotunaTrackVote


def test_list_for_user_includes_owned_and_member_playlists(db_session, user, other_user):
    owned_playlist = votuna_playlist_crud.create(
        db_session,
        {
            "owner_user_id": user.id,
            "provider": "soundcloud",
            "provider_playlist_id": f"owned-{uuid.uuid4().hex}",
            "title": "Owned Playlist",
            "description": "Owned",
            "image_url": None,
            "is_active": True,
        },
    )
    shared_playlist = votuna_playlist_crud.create(
        db_session,
        {
            "owner_user_id": other_user.id,
            "provider": "soundcloud",
            "provider_playlist_id": f"shared-{uuid.uuid4().hex}",
            "title": "Shared Playlist",
            "description": "Shared",
            "image_url": None,
            "is_active": True,
        },
    )
    votuna_playlist_member_crud.create(
        db_session,
        {
            "playlist_id": shared_playlist.id,
            "user_id": user.id,
            "role": "member",
        },
    )

    playlist_ids = {playlist.id for playlist in votuna_playlist_crud.list_for_user(db_session, user.id)}
    assert owned_playlist.id in playlist_ids
    assert shared_playlist.id in playlist_ids


def test_suggestion_crud_status_helpers(db_session, votuna_playlist, user):
    pending = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-pending",
            "track_title": "Pending",
            "suggested_by_user_id": user.id,
            "status": "pending",
        },
    )
    accepted = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-accepted",
            "track_title": "Accepted",
            "suggested_by_user_id": user.id,
            "status": "accepted",
        },
    )

    pending_lookup = votuna_track_suggestion_crud.get_pending_by_track(
        db_session,
        votuna_playlist.id,
        pending.provider_track_id,
    )
    accepted_lookup = votuna_track_suggestion_crud.get_pending_by_track(
        db_session,
        votuna_playlist.id,
        accepted.provider_track_id,
    )
    accepted_only = votuna_track_suggestion_crud.list_for_playlist(
        db_session,
        votuna_playlist.id,
        status="accepted",
    )

    assert pending_lookup is not None
    assert pending_lookup.id == pending.id
    assert accepted_lookup is None
    assert [item.id for item in accepted_only] == [accepted.id]


def test_vote_crud_list_voter_display_names_order_and_fallbacks(db_session, votuna_playlist, user):
    suggestion = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-vote-names",
            "track_title": "Vote Names",
            "suggested_by_user_id": user.id,
            "status": "pending",
        },
    )
    first_name_user = user_crud.create(
        db_session,
        {
            "auth_provider": "soundcloud",
            "provider_user_id": f"first-name-{uuid.uuid4().hex}",
            "email": "first-name@example.com",
            "first_name": "FirstNameOnly",
            "last_name": "User",
            "display_name": None,
            "access_token": "token",
            "is_active": True,
        },
    )
    email_user = user_crud.create(
        db_session,
        {
            "auth_provider": "soundcloud",
            "provider_user_id": f"email-only-{uuid.uuid4().hex}",
            "email": "email-only@example.com",
            "first_name": None,
            "last_name": "User",
            "display_name": None,
            "access_token": "token",
            "is_active": True,
        },
    )
    provider_id_user = user_crud.create(
        db_session,
        {
            "auth_provider": "soundcloud",
            "provider_user_id": f"provider-only-{uuid.uuid4().hex}",
            "email": None,
            "first_name": None,
            "last_name": "User",
            "display_name": None,
            "access_token": "token",
            "is_active": True,
        },
    )
    user_id_fallback_user = user_crud.create(
        db_session,
        {
            "auth_provider": "soundcloud",
            "provider_user_id": "",
            "email": None,
            "first_name": None,
            "last_name": "User",
            "display_name": None,
            "access_token": "token",
            "is_active": True,
        },
    )

    votes = [
        votuna_track_vote_crud.create(
            db_session,
            {
                "suggestion_id": suggestion.id,
                "user_id": first_name_user.id,
            },
        ),
        votuna_track_vote_crud.create(
            db_session,
            {
                "suggestion_id": suggestion.id,
                "user_id": email_user.id,
            },
        ),
        votuna_track_vote_crud.create(
            db_session,
            {
                "suggestion_id": suggestion.id,
                "user_id": provider_id_user.id,
            },
        ),
        votuna_track_vote_crud.create(
            db_session,
            {
                "suggestion_id": suggestion.id,
                "user_id": user_id_fallback_user.id,
            },
        ),
    ]

    base_time = datetime(2025, 1, 1, tzinfo=timezone.utc)
    for index, vote in enumerate(votes):
        db_session.query(VotunaTrackVote).filter(VotunaTrackVote.id == vote.id).update(
            {VotunaTrackVote.created_at: base_time + timedelta(minutes=index)}
        )
    db_session.commit()

    names = votuna_track_vote_crud.list_voter_display_names(db_session, suggestion.id)
    assert names == [
        "FirstNameOnly",
        "email-only@example.com",
        provider_id_user.provider_user_id,
        f"User {user_id_fallback_user.id}",
    ]


def test_vote_crud_duplicate_vote_raises_integrity_error(db_session, votuna_playlist, user):
    suggestion = votuna_track_suggestion_crud.create(
        db_session,
        {
            "playlist_id": votuna_playlist.id,
            "provider_track_id": "track-vote-duplicate",
            "track_title": "Vote Duplicate",
            "suggested_by_user_id": user.id,
            "status": "pending",
        },
    )
    votuna_track_vote_crud.create(
        db_session,
        {
            "suggestion_id": suggestion.id,
            "user_id": user.id,
        },
    )

    with pytest.raises(IntegrityError):
        votuna_track_vote_crud.create(
            db_session,
            {
                "suggestion_id": suggestion.id,
                "user_id": user.id,
            },
        )

    assert votuna_track_vote_crud.count_votes(db_session, suggestion.id) == 1
