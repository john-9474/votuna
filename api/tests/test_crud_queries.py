import uuid

from app.crud.votuna_playlist import votuna_playlist_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_track_suggestion import votuna_track_suggestion_crud


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
