"""Spotify provider integration."""

from __future__ import annotations

from typing import Any, Sequence
from urllib.parse import urlparse

import httpx

from app.config.settings import settings
from app.services.music_providers.base import (
    MusicProviderClient,
    ProviderAPIError,
    ProviderAuthError,
    ProviderPlaylist,
    ProviderTrack,
    ProviderUser,
)


class SpotifyProvider(MusicProviderClient):
    provider = "spotify"

    def __init__(self, access_token: str):
        super().__init__(access_token)
        self.base_url = settings.SPOTIFY_API_BASE_URL or "https://api.spotify.com/v1"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    @staticmethod
    def _first_image_url(images_payload: Any) -> str | None:
        if not isinstance(images_payload, list):
            return None
        for item in images_payload:
            if not isinstance(item, dict):
                continue
            url = item.get("url")
            if isinstance(url, str) and url.strip():
                return url
        return None

    @staticmethod
    def _extract_provider_message(payload: Any) -> str | None:
        if not isinstance(payload, dict):
            return None
        error_payload = payload.get("error")
        if isinstance(error_payload, dict):
            message = error_payload.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()
        elif isinstance(error_payload, str) and error_payload.strip():
            return error_payload.strip()
        message = payload.get("message")
        if isinstance(message, str) and message.strip():
            return message.strip()
        return None

    @staticmethod
    def _extract_playlist_track_count(payload: Any) -> int | None:
        if not isinstance(payload, dict):
            return None
        # Spotify has returned playlist totals in `tracks.total` historically
        # and now returns `items.total` in current payloads.
        for key in ("tracks", "items"):
            container = payload.get(key)
            if not isinstance(container, dict):
                continue
            raw_total = container.get("total")
            if isinstance(raw_total, int):
                return raw_total
        return None

    def _raise_for_status(self, response: httpx.Response) -> None:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            provider_message: str | None = None
            try:
                payload = exc.response.json()
                provider_message = self._extract_provider_message(payload)
            except Exception:
                provider_message = None

            if status_code in {401, 403}:
                raise ProviderAuthError("Spotify authorization expired or invalid") from exc

            detail_suffix = f": {provider_message}" if provider_message else ""
            raise ProviderAPIError(
                f"Spotify API error ({status_code}){detail_suffix}",
                status_code=status_code,
            ) from exc

    @staticmethod
    def _clean_id(value: str) -> str | None:
        cleaned = value.strip()
        return cleaned or None

    @classmethod
    def _extract_id_from_open_url(cls, url: str, resource: str) -> str | None:
        try:
            parsed = urlparse(url)
        except Exception:
            return None
        host = (parsed.netloc or "").lower()
        if "spotify.com" not in host:
            return None
        segments = [segment for segment in parsed.path.split("/") if segment]
        if not segments:
            return None
        if segments[0].lower().startswith("intl-") and len(segments) > 1:
            segments = segments[1:]
        for index, segment in enumerate(segments):
            if segment.lower() != resource:
                continue
            if index + 1 >= len(segments):
                return None
            return cls._clean_id(segments[index + 1])
        return None

    @classmethod
    def _normalize_resource_id(cls, value: str, resource: str) -> str | None:
        raw_value = value.strip()
        if not raw_value:
            return None
        prefix = f"spotify:{resource}:"
        if raw_value.lower().startswith(prefix):
            return cls._clean_id(raw_value.split(":", 2)[-1])
        if raw_value.startswith("http://") or raw_value.startswith("https://"):
            return cls._extract_id_from_open_url(raw_value, resource)
        if "open.spotify.com/" in raw_value.lower():
            return cls._extract_id_from_open_url(f"https://{raw_value}", resource)
        return cls._clean_id(raw_value)

    @classmethod
    def _to_track_uri(cls, value: str) -> str | None:
        normalized_track_id = cls._normalize_resource_id(value, "track")
        if not normalized_track_id:
            return None
        return f"spotify:track:{normalized_track_id}"

    def _to_provider_playlist(self, payload: Any) -> ProviderPlaylist | None:
        if not isinstance(payload, dict):
            return None
        playlist_id = self._clean_id(str(payload.get("id") or ""))
        if not playlist_id:
            return None
        track_count = self._extract_playlist_track_count(payload)
        external_urls = payload.get("external_urls")
        playlist_url = external_urls.get("spotify") if isinstance(external_urls, dict) else None
        is_public = payload.get("public") if isinstance(payload.get("public"), bool) else None
        return ProviderPlaylist(
            provider=self.provider,
            provider_playlist_id=playlist_id,
            title=payload.get("name") or "Untitled",
            description=payload.get("description"),
            image_url=self._first_image_url(payload.get("images")),
            url=playlist_url if isinstance(playlist_url, str) else None,
            track_count=track_count,
            is_public=is_public,
        )

    def _to_provider_track(self, payload: Any) -> ProviderTrack | None:
        if not isinstance(payload, dict):
            return None
        track_id = self._clean_id(str(payload.get("id") or ""))
        if not track_id:
            return None
        artists_payload = payload.get("artists")
        artist_names: list[str] = []
        if isinstance(artists_payload, list):
            for artist_payload in artists_payload:
                if not isinstance(artist_payload, dict):
                    continue
                name = artist_payload.get("name")
                if isinstance(name, str) and name.strip():
                    artist_names.append(name.strip())
        album_payload = payload.get("album")
        artwork_url = None
        if isinstance(album_payload, dict):
            artwork_url = self._first_image_url(album_payload.get("images"))
        external_urls = payload.get("external_urls")
        track_url = external_urls.get("spotify") if isinstance(external_urls, dict) else None
        return ProviderTrack(
            provider_track_id=track_id,
            title=payload.get("name") or "Untitled",
            artist=", ".join(artist_names) if artist_names else None,
            genre=None,
            artwork_url=artwork_url,
            url=track_url if isinstance(track_url, str) else None,
        )

    def _to_provider_user(self, payload: Any) -> ProviderUser | None:
        if not isinstance(payload, dict):
            return None
        user_id = self._clean_id(str(payload.get("id") or ""))
        if not user_id:
            return None
        external_urls = payload.get("external_urls")
        profile_url = external_urls.get("spotify") if isinstance(external_urls, dict) else None
        return ProviderUser(
            provider_user_id=user_id,
            username=user_id,
            display_name=payload.get("display_name") or user_id,
            avatar_url=self._first_image_url(payload.get("images")),
            profile_url=profile_url if isinstance(profile_url, str) else None,
        )

    async def _fetch_current_user_id(self, client: httpx.AsyncClient) -> str:
        response = await client.get(
            "/me",
            headers=self._headers(),
        )
        self._raise_for_status(response)
        payload = response.json()
        if not isinstance(payload, dict):
            raise ProviderAPIError("Unable to fetch Spotify user profile", status_code=502)
        user_id = self._clean_id(str(payload.get("id") or ""))
        if not user_id:
            raise ProviderAPIError("Unable to fetch Spotify user profile", status_code=502)
        return user_id

    async def list_playlists(self) -> Sequence[ProviderPlaylist]:
        playlists: list[ProviderPlaylist] = []
        next_url: str | None = "/me/playlists"
        params: dict[str, int] | None = {"limit": 50}
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            while next_url:
                response = await client.get(next_url, headers=self._headers(), params=params)
                self._raise_for_status(response)
                payload = response.json()
                if not isinstance(payload, dict):
                    break
                items = payload.get("items")
                if isinstance(items, list):
                    for item in items:
                        mapped = self._to_provider_playlist(item)
                        if mapped:
                            playlists.append(mapped)
                raw_next = payload.get("next")
                next_url = raw_next if isinstance(raw_next, str) and raw_next else None
                params = None
        return playlists

    async def get_playlist(self, provider_playlist_id: str) -> ProviderPlaylist:
        playlist_id = self._normalize_resource_id(provider_playlist_id, "playlist")
        if not playlist_id:
            raise ProviderAPIError("Playlist id is required", status_code=400)
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                f"/playlists/{playlist_id}",
                headers=self._headers(),
            )
            self._raise_for_status(response)
            payload = response.json()
        mapped = self._to_provider_playlist(payload)
        if not mapped:
            raise ProviderAPIError("Unable to load playlist", status_code=404)
        return mapped

    async def search_playlists(self, query: str, limit: int = 10) -> Sequence[ProviderPlaylist]:
        search_query = query.strip()
        if not search_query:
            return []
        safe_limit = max(1, min(limit, 25))
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                "/search",
                headers=self._headers(),
                params={
                    "q": search_query,
                    "type": "playlist",
                    "limit": safe_limit,
                },
            )
            self._raise_for_status(response)
            payload = response.json()
        if not isinstance(payload, dict):
            return []
        playlists_payload = payload.get("playlists")
        if not isinstance(playlists_payload, dict):
            return []
        items = playlists_payload.get("items")
        if not isinstance(items, list):
            return []
        results: list[ProviderPlaylist] = []
        for item in items:
            mapped = self._to_provider_playlist(item)
            if mapped:
                results.append(mapped)
        return results

    async def resolve_playlist_url(self, url: str) -> ProviderPlaylist:
        playlist_ref = url.strip()
        if not playlist_ref:
            raise ProviderAPIError("Playlist URL is required", status_code=400)
        playlist_id = self._normalize_resource_id(playlist_ref, "playlist")
        if not playlist_id:
            raise ProviderAPIError("Resolved URL is not a playlist", status_code=400)
        return await self.get_playlist(playlist_id)

    async def create_playlist(
        self,
        title: str,
        description: str | None = None,
        is_public: bool | None = None,
    ) -> ProviderPlaylist:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            user_id = await self._fetch_current_user_id(client)
            response = await client.post(
                f"/users/{user_id}/playlists",
                headers=self._headers(),
                json={
                    "name": title,
                    "description": description or "",
                    "public": bool(is_public),
                },
            )
            self._raise_for_status(response)
            payload = response.json()
        mapped = self._to_provider_playlist(payload)
        if not mapped:
            raise ProviderAPIError("Unable to create playlist", status_code=502)
        return ProviderPlaylist(
            provider=mapped.provider,
            provider_playlist_id=mapped.provider_playlist_id,
            title=mapped.title or title,
            description=mapped.description if mapped.description is not None else description,
            image_url=mapped.image_url,
            url=mapped.url,
            track_count=mapped.track_count,
            is_public=mapped.is_public,
        )

    async def list_tracks(self, provider_playlist_id: str) -> Sequence[ProviderTrack]:
        playlist_id = self._normalize_resource_id(provider_playlist_id, "playlist")
        if not playlist_id:
            raise ProviderAPIError("Playlist id is required", status_code=400)
        tracks: list[ProviderTrack] = []
        next_url: str | None = f"/playlists/{playlist_id}/items"
        params: dict[str, int | str] | None = {"limit": 100, "offset": 0}
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            while next_url:
                response = await client.get(next_url, headers=self._headers(), params=params)
                self._raise_for_status(response)
                payload = response.json()
                if not isinstance(payload, dict):
                    break
                items = payload.get("items")
                if isinstance(items, list):
                    for item in items:
                        if not isinstance(item, dict):
                            continue
                        # Spotify currently returns playlist entries as `item`,
                        # while older payloads and some SDK shapes use `track`.
                        track_payload = item.get("item")
                        if not isinstance(track_payload, dict):
                            track_payload = item.get("track")
                        mapped = self._to_provider_track(track_payload)
                        if mapped:
                            tracks.append(mapped)
                raw_next = payload.get("next")
                next_url = raw_next if isinstance(raw_next, str) and raw_next else None
                params = None
        return tracks

    async def add_tracks(self, provider_playlist_id: str, track_ids: Sequence[str]) -> None:
        playlist_id = self._normalize_resource_id(provider_playlist_id, "playlist")
        if not playlist_id:
            raise ProviderAPIError("Playlist id is required", status_code=400)
        normalized_uris: list[str] = []
        seen_uris: set[str] = set()
        for track_id in track_ids:
            track_uri = self._to_track_uri(str(track_id))
            if not track_uri or track_uri in seen_uris:
                continue
            seen_uris.add(track_uri)
            normalized_uris.append(track_uri)
        if not normalized_uris:
            return
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.post(
                f"/playlists/{playlist_id}/items",
                headers=self._headers(),
                json={"uris": normalized_uris},
            )
            self._raise_for_status(response)

    async def remove_tracks(self, provider_playlist_id: str, track_ids: Sequence[str]) -> None:
        playlist_id = self._normalize_resource_id(provider_playlist_id, "playlist")
        if not playlist_id:
            raise ProviderAPIError("Playlist id is required", status_code=400)
        normalized_tracks_payload: list[dict[str, str]] = []
        seen_uris: set[str] = set()
        for track_id in track_ids:
            track_uri = self._to_track_uri(str(track_id))
            if not track_uri or track_uri in seen_uris:
                continue
            seen_uris.add(track_uri)
            normalized_tracks_payload.append({"uri": track_uri})
        if not normalized_tracks_payload:
            return
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.request(
                "DELETE",
                f"/playlists/{playlist_id}/items",
                headers=self._headers(),
                json={"tracks": normalized_tracks_payload},
            )
            self._raise_for_status(response)

    async def search_tracks(self, query: str, limit: int = 10) -> Sequence[ProviderTrack]:
        search_query = query.strip()
        if not search_query:
            return []
        safe_limit = max(1, min(limit, 25))
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                "/search",
                headers=self._headers(),
                params={
                    "q": search_query,
                    "type": "track",
                    "limit": safe_limit,
                },
            )
            self._raise_for_status(response)
            payload = response.json()
        if not isinstance(payload, dict):
            return []
        tracks_payload = payload.get("tracks")
        if not isinstance(tracks_payload, dict):
            return []
        items = tracks_payload.get("items")
        if not isinstance(items, list):
            return []
        results: list[ProviderTrack] = []
        for item in items:
            mapped = self._to_provider_track(item)
            if mapped:
                results.append(mapped)
        return results

    async def related_tracks(
        self,
        provider_track_id: str,
        limit: int = 25,
        offset: int = 0,
    ) -> Sequence[ProviderTrack]:
        # Spotify recommendations endpoint is deprecated; keep this flow safe and non-breaking.
        return []

    async def resolve_track_url(self, url: str) -> ProviderTrack:
        track_ref = url.strip()
        if not track_ref:
            raise ProviderAPIError("Track URL is required", status_code=400)
        track_id = self._normalize_resource_id(track_ref, "track")
        if not track_id:
            raise ProviderAPIError("Resolved URL is not a track", status_code=400)
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                f"/tracks/{track_id}",
                headers=self._headers(),
            )
            self._raise_for_status(response)
            payload = response.json()
        mapped_track = self._to_provider_track(payload)
        if not mapped_track:
            raise ProviderAPIError("Unable to resolve track URL", status_code=404)
        return mapped_track

    async def search_users(self, query: str, limit: int = 10) -> Sequence[ProviderUser]:
        # Spotify no longer offers provider-side user search for this use case.
        return []

    async def get_user(self, provider_user_id: str) -> ProviderUser:
        user_id = self._normalize_resource_id(provider_user_id, "user")
        if not user_id:
            raise ProviderAPIError("Provider user id is required", status_code=400)
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                f"/users/{user_id}",
                headers=self._headers(),
            )
            self._raise_for_status(response)
            payload = response.json()
        mapped_user = self._to_provider_user(payload)
        if not mapped_user:
            raise ProviderAPIError("Provider user not found", status_code=404)
        return mapped_user
