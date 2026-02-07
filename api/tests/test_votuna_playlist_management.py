import uuid

from app.crud.votuna_playlist import votuna_playlist_crud
from app.crud.votuna_playlist_member import votuna_playlist_member_crud
from app.crud.votuna_playlist_settings import votuna_playlist_settings_crud
from app.services.music_providers.base import ProviderTrack


def _create_owned_votuna_playlist(db_session, owner_user, provider_playlist_id: str | None = None):
    playlist = votuna_playlist_crud.create(
        db_session,
        {
            "owner_user_id": owner_user.id,
            "provider": "soundcloud",
            "provider_playlist_id": provider_playlist_id or f"pl-{uuid.uuid4().hex}",
            "title": "Counterparty Playlist",
            "description": None,
            "image_url": None,
            "is_active": True,
        },
    )
    votuna_playlist_settings_crud.create(
        db_session,
        {
            "playlist_id": playlist.id,
            "required_vote_percent": 60,
            "auto_add_on_threshold": False,
        },
    )
    votuna_playlist_member_crud.create(
        db_session,
        {
            "playlist_id": playlist.id,
            "user_id": owner_user.id,
            "role": "owner",
        },
    )
    return playlist


def test_preview_import_owner_success(auth_client, votuna_playlist, provider_stub):
    provider_stub.tracks_by_playlist_id[votuna_playlist.provider_playlist_id] = [
        ProviderTrack(provider_track_id="track-1", title="Current One", artist="A", genre="House"),
    ]
    provider_stub.tracks_by_playlist_id["source-1"] = [
        ProviderTrack(provider_track_id="track-1", title="Current One", artist="A", genre="House"),
        ProviderTrack(provider_track_id="track-2", title="Incoming Two", artist="B", genre="UKG"),
    ]

    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/preview",
        json={
            "direction": "import_to_current",
            "counterparty": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "source-1",
            },
            "selection_mode": "all",
            "selection_values": [],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["matched_count"] == 2
    assert data["to_add_count"] == 1
    assert data["duplicate_count"] == 1
    assert data["source"]["provider_playlist_id"] == "source-1"
    assert data["destination"]["provider_playlist_id"] == votuna_playlist.provider_playlist_id


def test_execute_export_to_existing_success(auth_client, votuna_playlist, provider_stub):
    provider_stub.tracks_by_playlist_id[votuna_playlist.provider_playlist_id] = [
        ProviderTrack(provider_track_id="track-1", title="Current One", artist="A", genre="House"),
        ProviderTrack(provider_track_id="track-2", title="Current Two", artist="B", genre="UKG"),
    ]
    provider_stub.tracks_by_playlist_id["export-dest-1"] = [
        ProviderTrack(provider_track_id="track-1", title="Current One", artist="A", genre="House"),
    ]

    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/execute",
        json={
            "direction": "export_from_current",
            "counterparty": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "export-dest-1",
            },
            "selection_mode": "all",
            "selection_values": [],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["matched_count"] == 2
    assert data["added_count"] == 1
    assert data["skipped_duplicate_count"] == 1
    assert data["failed_count"] == 0


def test_management_non_owner_forbidden(other_auth_client, votuna_playlist):
    response = other_auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/preview",
        json={
            "direction": "import_to_current",
            "counterparty": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "source-1",
            },
            "selection_mode": "all",
            "selection_values": [],
        },
    )
    assert response.status_code == 403


def test_votuna_counterparty_not_owned_forbidden(
    auth_client,
    db_session,
    user,
    other_user,
    votuna_playlist,
):
    foreign_playlist = _create_owned_votuna_playlist(db_session, other_user)
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/preview",
        json={
            "direction": "import_to_current",
            "counterparty": {
                "kind": "votuna",
                "votuna_playlist_id": foreign_playlist.id,
            },
            "selection_mode": "all",
            "selection_values": [],
        },
    )
    assert response.status_code == 403


def test_cross_provider_blocked(auth_client, votuna_playlist):
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/preview",
        json={
            "direction": "import_to_current",
            "counterparty": {
                "kind": "provider",
                "provider": "spotify",
                "provider_playlist_id": "sp-1",
            },
            "selection_mode": "all",
            "selection_values": [],
        },
    )
    assert response.status_code == 400
    assert "Cross-provider" in response.json()["detail"]


def test_genre_filter_case_insensitive_exact(auth_client, votuna_playlist, provider_stub):
    provider_stub.tracks_by_playlist_id[votuna_playlist.provider_playlist_id] = []
    provider_stub.tracks_by_playlist_id["source-1"] = [
        ProviderTrack(provider_track_id="track-1", title="House One", artist="A", genre="House"),
        ProviderTrack(provider_track_id="track-2", title="Techno One", artist="B", genre="Techno"),
    ]

    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/preview",
        json={
            "direction": "import_to_current",
            "counterparty": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "source-1",
            },
            "selection_mode": "genre",
            "selection_values": ["  house  "],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["matched_count"] == 1
    assert data["to_add_count"] == 1


def test_artist_filter_case_insensitive_exact(auth_client, votuna_playlist, provider_stub):
    provider_stub.tracks_by_playlist_id[votuna_playlist.provider_playlist_id] = []
    provider_stub.tracks_by_playlist_id["source-1"] = [
        ProviderTrack(provider_track_id="track-1", title="Song One", artist="Artist One", genre="House"),
        ProviderTrack(provider_track_id="track-2", title="Song Two", artist="Artist Two", genre="House"),
    ]

    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/preview",
        json={
            "direction": "import_to_current",
            "counterparty": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "source-1",
            },
            "selection_mode": "artist",
            "selection_values": ["artist two"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["matched_count"] == 1
    assert data["to_add_count"] == 1


def test_song_filter_selected_ids_only(auth_client, votuna_playlist, provider_stub):
    provider_stub.tracks_by_playlist_id[votuna_playlist.provider_playlist_id] = []
    provider_stub.tracks_by_playlist_id["source-1"] = [
        ProviderTrack(provider_track_id="track-1", title="Song One", artist="Artist One", genre="House"),
        ProviderTrack(provider_track_id="track-2", title="Song Two", artist="Artist Two", genre="House"),
    ]

    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/preview",
        json={
            "direction": "import_to_current",
            "counterparty": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "source-1",
            },
            "selection_mode": "songs",
            "selection_values": ["track-2"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["matched_count"] == 1
    assert data["to_add_count"] == 1


def test_preview_rejects_over_limit(auth_client, votuna_playlist, provider_stub):
    provider_stub.tracks_by_playlist_id[votuna_playlist.provider_playlist_id] = []
    provider_stub.tracks_by_playlist_id["source-1"] = [
        ProviderTrack(
            provider_track_id=f"track-{index}",
            title=f"Track {index}",
            artist="Bulk Artist",
            genre="House",
        )
        for index in range(501)
    ]

    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/preview",
        json={
            "direction": "import_to_current",
            "counterparty": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "source-1",
            },
            "selection_mode": "all",
            "selection_values": [],
        },
    )
    assert response.status_code == 400
    assert "500" in response.json()["detail"]


def test_execute_export_with_destination_create(auth_client, votuna_playlist, provider_stub):
    provider_stub.tracks_by_playlist_id[votuna_playlist.provider_playlist_id] = [
        ProviderTrack(provider_track_id="track-1", title="Song One", artist="Artist One", genre="House"),
        ProviderTrack(provider_track_id="track-2", title="Song Two", artist="Artist Two", genre="UKG"),
    ]

    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/execute",
        json={
            "direction": "export_from_current",
            "destination_create": {
                "title": "Created Destination",
                "description": "New destination",
                "is_public": False,
            },
            "selection_mode": "all",
            "selection_values": [],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["created_destination"] is not None
    assert data["destination"]["provider_playlist_id"] == "created-1"
    assert data["added_count"] == 2
    assert data["failed_count"] == 0


def test_execute_best_effort_chunk_fallback(auth_client, votuna_playlist, provider_stub):
    provider_stub.tracks_by_playlist_id[votuna_playlist.provider_playlist_id] = [
        ProviderTrack(provider_track_id="ok-track-1", title="OK 1", artist="A", genre="House"),
        ProviderTrack(provider_track_id="fail-track", title="Fail", artist="B", genre="House"),
        ProviderTrack(provider_track_id="ok-track-2", title="OK 2", artist="C", genre="House"),
    ]
    provider_stub.tracks_by_playlist_id["export-dest-1"] = []
    provider_stub.fail_add_chunk_for_track_ids = {"fail-track"}
    provider_stub.fail_add_single_for_track_ids = {"fail-track"}

    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/execute",
        json={
            "direction": "export_from_current",
            "counterparty": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "export-dest-1",
            },
            "selection_mode": "all",
            "selection_values": [],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["matched_count"] == 3
    assert data["added_count"] == 2
    assert data["failed_count"] == 1
    assert data["failed_items"][0]["provider_track_id"] == "fail-track"


def test_source_tracks_search_and_pagination(auth_client, votuna_playlist, provider_stub):
    provider_stub.tracks_by_playlist_id["source-1"] = [
        ProviderTrack(provider_track_id="t-1", title="Alpha", artist="DJ A", genre="House"),
        ProviderTrack(provider_track_id="t-2", title="Beta", artist="DJ B", genre="Techno"),
        ProviderTrack(provider_track_id="t-3", title="Gamma", artist="DJ C", genre="Techno"),
    ]

    search_response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/source-tracks",
        json={
            "source": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "source-1",
            },
            "search": "techno",
            "limit": 10,
            "offset": 0,
        },
    )
    assert search_response.status_code == 200
    search_data = search_response.json()
    assert search_data["total_count"] == 2
    assert len(search_data["tracks"]) == 2

    page_response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/source-tracks",
        json={
            "source": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "source-1",
            },
            "limit": 1,
            "offset": 1,
        },
    )
    assert page_response.status_code == 200
    page_data = page_response.json()
    assert page_data["total_count"] == 3
    assert page_data["limit"] == 1
    assert page_data["offset"] == 1
    assert len(page_data["tracks"]) == 1


def test_facets_owner_success_with_sorting_and_normalization(auth_client, votuna_playlist, provider_stub):
    provider_stub.tracks_by_playlist_id["source-1"] = [
        ProviderTrack(provider_track_id="t-1", title="Alpha", artist="DJ Zebra", genre=" House "),
        ProviderTrack(provider_track_id="t-2", title="Beta", artist="dj zebra", genre="house"),
        ProviderTrack(provider_track_id="t-3", title="Gamma", artist="DJ Alpha", genre="Techno"),
        ProviderTrack(provider_track_id="t-4", title="Delta", artist="DJ Alpha", genre="techno"),
        ProviderTrack(provider_track_id="t-5", title="Empty", artist="", genre=""),
        ProviderTrack(provider_track_id="t-6", title="None", artist=None, genre=None),
    ]

    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/facets",
        json={
            "source": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "source-1",
            }
        },
    )
    assert response.status_code == 200
    data = response.json()

    assert data["total_tracks_considered"] == 6
    assert data["genres"] == [
        {"value": "House", "count": 2},
        {"value": "Techno", "count": 2},
    ]
    assert data["artists"] == [
        {"value": "DJ Alpha", "count": 2},
        {"value": "DJ Zebra", "count": 2},
    ]


def test_facets_non_owner_forbidden(other_auth_client, votuna_playlist):
    response = other_auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/facets",
        json={
            "source": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "source-1",
            }
        },
    )
    assert response.status_code == 403


def test_facets_votuna_counterparty_not_owned_forbidden(
    auth_client,
    db_session,
    other_user,
    votuna_playlist,
):
    foreign_playlist = _create_owned_votuna_playlist(db_session, other_user)
    response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/facets",
        json={
            "source": {
                "kind": "votuna",
                "votuna_playlist_id": foreign_playlist.id,
            }
        },
    )
    assert response.status_code == 403


def test_facets_empty_and_top_100_cap(auth_client, votuna_playlist, provider_stub):
    provider_stub.tracks_by_playlist_id["empty-source"] = [
        ProviderTrack(provider_track_id="e-1", title="Empty", artist=None, genre=None),
        ProviderTrack(provider_track_id="e-2", title="Blank", artist=" ", genre=" "),
    ]
    empty_response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/facets",
        json={
            "source": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "empty-source",
            }
        },
    )
    assert empty_response.status_code == 200
    empty_data = empty_response.json()
    assert empty_data["total_tracks_considered"] == 2
    assert empty_data["genres"] == []
    assert empty_data["artists"] == []

    provider_stub.tracks_by_playlist_id["large-source"] = [
        ProviderTrack(
            provider_track_id=f"t-{index}",
            title=f"Track {index}",
            artist=f"Artist {index}",
            genre=f"Genre {index}",
        )
        for index in range(120)
    ]
    cap_response = auth_client.post(
        f"/api/v1/votuna/playlists/{votuna_playlist.id}/management/facets",
        json={
            "source": {
                "kind": "provider",
                "provider": "soundcloud",
                "provider_playlist_id": "large-source",
            }
        },
    )
    assert cap_response.status_code == 200
    cap_data = cap_response.json()
    assert cap_data["total_tracks_considered"] == 120
    assert len(cap_data["genres"]) == 100
    assert len(cap_data["artists"]) == 100
