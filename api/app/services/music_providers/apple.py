"""Apple Music provider integration."""

from __future__ import annotations

import asyncio
import time
from typing import Any, Sequence
from urllib.parse import parse_qs, quote, urlparse

import httpx
import jwt

from app.config.settings import settings
from app.services.music_providers.base import (
    MusicProviderClient,
    ProviderAPIError,
    ProviderAuthError,
    ProviderPlaylist,
    ProviderShuffleResult,
    ProviderTrack,
    ProviderUser,
)


class AppleMusicProvider(MusicProviderClient):
    provider = "apple"
    _REQUEST_TIMEOUT_SECONDS = 15
    _DEVELOPER_TOKEN_SKEW_SECONDS = 300
    _TRACK_TYPES = {"library-songs", "library-music-videos", "songs", "music-videos"}

    _developer_token_lock = asyncio.Lock()
    _developer_token_cache: tuple[str, float] | None = None

    def __init__(self, access_token: str):
        super().__init__(access_token)
        self.base_url = settings.APPLE_MUSIC_API_BASE_URL or "https://api.music.apple.com"
        self.storefront = (settings.APPLE_MUSIC_STOREFRONT or "us").strip() or "us"

    @classmethod
    def _clean_id(cls, value: str) -> str | None:
        cleaned = value.strip()
        return cleaned or None

    @staticmethod
    def _extract_error_message(payload: Any) -> str | None:
        if not isinstance(payload, dict):
            return None
        errors = payload.get("errors")
        if isinstance(errors, list):
            for error in errors:
                if not isinstance(error, dict):
                    continue
                title = error.get("title")
                detail = error.get("detail")
                if isinstance(detail, str) and detail.strip():
                    return detail.strip()
                if isinstance(title, str) and title.strip():
                    return title.strip()
        message = payload.get("message")
        if isinstance(message, str) and message.strip():
            return message.strip()
        return None

    @classmethod
    def _raise_for_status(cls, response: httpx.Response) -> None:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            provider_message = None
            try:
                provider_message = cls._extract_error_message(exc.response.json())
            except Exception:
                provider_message = None

            if status_code in {401, 403}:
                raise ProviderAuthError("Apple Music authorization expired or invalid") from exc

            detail_suffix = f": {provider_message}" if provider_message else ""
            if status_code == 429:
                raise ProviderAPIError(
                    f"Apple Music API rate limit exceeded (429){detail_suffix}",
                    status_code=status_code,
                ) from exc
            raise ProviderAPIError(
                f"Apple Music API error ({status_code}){detail_suffix}",
                status_code=status_code,
            ) from exc

    @staticmethod
    def _extract_description(value: Any) -> str | None:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            for key in ("standard", "short"):
                description = value.get(key)
                if isinstance(description, str) and description.strip():
                    return description.strip()
        return None

    @staticmethod
    def _first_text(values: Any) -> str | None:
        if not isinstance(values, list):
            return None
        for value in values:
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    @staticmethod
    def _format_artwork_url(value: Any) -> str | None:
        if not isinstance(value, dict):
            return None
        template_url = value.get("url")
        if not isinstance(template_url, str) or not template_url.strip():
            return None
        width = value.get("width") if isinstance(value.get("width"), int) and value.get("width") else 500
        height = value.get("height") if isinstance(value.get("height"), int) and value.get("height") else 500
        return template_url.replace("{w}", str(width)).replace("{h}", str(height))

    @classmethod
    def _extract_id_from_url(cls, raw_url: str, resource: str) -> str | None:
        try:
            parsed = urlparse(raw_url)
        except Exception:
            return None
        host = (parsed.netloc or "").lower()
        if "music.apple.com" not in host:
            return None
        query = parse_qs(parsed.query)
        if resource == "track":
            query_track = cls._clean_id((query.get("i") or [""])[0])
            if query_track:
                return query_track
        segments = [segment for segment in parsed.path.split("/") if segment]
        if not segments:
            return None
        for index, segment in enumerate(segments):
            if segment.lower() != resource:
                continue
            if index + 1 >= len(segments):
                return None
            candidate = cls._clean_id(segments[index + 1])
            if candidate:
                return candidate
        if resource == "playlist":
            return cls._clean_id(segments[-1])
        if resource == "track":
            return cls._clean_id(segments[-1])
        return None

    @classmethod
    def _normalize_playlist_id(cls, value: str) -> str | None:
        raw_value = value.strip()
        if not raw_value:
            return None
        lower = raw_value.lower()
        if lower.startswith("apple:playlist:"):
            return cls._clean_id(raw_value.split(":", 2)[-1])
        if raw_value.startswith("http://") or raw_value.startswith("https://"):
            return cls._extract_id_from_url(raw_value, "playlist")
        if "music.apple.com/" in lower:
            return cls._extract_id_from_url(f"https://{raw_value}", "playlist")
        return cls._clean_id(raw_value)

    @classmethod
    def _normalize_track_ref(cls, value: str) -> tuple[str, str] | None:
        raw_value = value.strip()
        if not raw_value:
            return None
        lower = raw_value.lower()

        if lower.startswith("apple:"):
            parts = raw_value.split(":", 2)
            if len(parts) == 3 and parts[1] in cls._TRACK_TYPES:
                track_id = cls._clean_id(parts[2])
                if track_id:
                    return track_id, parts[1]

        if ":" in raw_value:
            maybe_type, maybe_id = raw_value.split(":", 1)
            maybe_type = maybe_type.strip().lower()
            if maybe_type in cls._TRACK_TYPES:
                track_id = cls._clean_id(maybe_id)
                if track_id:
                    return track_id, maybe_type

        if raw_value.startswith("http://") or raw_value.startswith("https://"):
            track_id = cls._extract_id_from_url(raw_value, "track")
            if track_id:
                return track_id, "songs"
            return None
        if "music.apple.com/" in lower:
            track_id = cls._extract_id_from_url(f"https://{raw_value}", "track")
            if track_id:
                return track_id, "songs"
            return None

        track_id = cls._clean_id(raw_value)
        if not track_id:
            return None
        if track_id.startswith("i."):
            return track_id, "library-songs"
        return track_id, "songs"

    @classmethod
    def _next_url_from_payload(cls, payload: Any) -> str | None:
        if not isinstance(payload, dict):
            return None
        raw_next = payload.get("next")
        if not isinstance(raw_next, str) or not raw_next.strip():
            return None
        return raw_next.strip()

    @classmethod
    def _extract_data_list(cls, payload: Any) -> list[Any]:
        if not isinstance(payload, dict):
            return []
        data = payload.get("data")
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return [data]
        return []

    async def _get_developer_token(self) -> str:
        static_token = (settings.APPLE_MUSIC_DEVELOPER_TOKEN or "").strip()
        if static_token:
            return static_token

        now = time.time()
        cached = self._developer_token_cache
        if cached and cached[1] > (now + self._DEVELOPER_TOKEN_SKEW_SECONDS):
            return cached[0]

        async with self._developer_token_lock:
            now = time.time()
            cached = self._developer_token_cache
            if cached and cached[1] > (now + self._DEVELOPER_TOKEN_SKEW_SECONDS):
                return cached[0]
            token, expires_at = self._generate_developer_token()
            self._developer_token_cache = (token, expires_at)
            return token

    @staticmethod
    def _generate_developer_token() -> tuple[str, float]:
        team_id = (settings.APPLE_MUSIC_TEAM_ID or "").strip()
        key_id = (settings.APPLE_MUSIC_KEY_ID or "").strip()
        private_key = (settings.APPLE_MUSIC_PRIVATE_KEY or "").strip()
        if not team_id or not key_id or not private_key:
            raise ProviderAPIError(
                "Apple Music developer token settings are missing",
                status_code=500,
            )
        normalized_private_key = private_key.replace("\\n", "\n")
        now = int(time.time())
        ttl_seconds = max(600, int(settings.APPLE_MUSIC_DEVELOPER_TOKEN_TTL_SECONDS or 15777000))
        exp = now + ttl_seconds
        try:
            token = jwt.encode(
                {"iss": team_id, "iat": now, "exp": exp},
                normalized_private_key,
                algorithm="ES256",
                headers={"kid": key_id},
            )
        except Exception as exc:
            raise ProviderAPIError(
                f"Unable to generate Apple Music developer token: {exc}",
                status_code=500,
            ) from exc
        if isinstance(token, bytes):
            token = token.decode("utf-8")
        return token, float(exp)

    async def _headers(self) -> dict[str, str]:
        music_user_token = (self.access_token or "").strip()
        if not music_user_token:
            raise ProviderAuthError("Missing Apple Music user token")
        developer_token = await self._get_developer_token()
        return {
            "Authorization": f"Bearer {developer_token}",
            "Music-User-Token": music_user_token,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def _to_provider_playlist(self, payload: Any) -> ProviderPlaylist | None:
        if not isinstance(payload, dict):
            return None
        playlist_id = self._clean_id(str(payload.get("id") or ""))
        if not playlist_id:
            return None
        attributes = payload.get("attributes") if isinstance(payload.get("attributes"), dict) else {}
        title = attributes.get("name")
        description = self._extract_description(attributes.get("description"))
        track_count = attributes.get("trackCount") if isinstance(attributes.get("trackCount"), int) else None
        is_public = attributes.get("isPublic") if isinstance(attributes.get("isPublic"), bool) else None
        playlist_url = attributes.get("url") if isinstance(attributes.get("url"), str) else None
        if not playlist_url:
            playlist_url = f"https://music.apple.com/library/playlist/{quote(playlist_id, safe='')}"
        return ProviderPlaylist(
            provider=self.provider,
            provider_playlist_id=playlist_id,
            title=title if isinstance(title, str) and title.strip() else "Untitled",
            description=description,
            image_url=self._format_artwork_url(attributes.get("artwork")),
            url=playlist_url,
            track_count=track_count,
            is_public=is_public,
        )

    def _to_provider_track(self, payload: Any) -> ProviderTrack | None:
        if not isinstance(payload, dict):
            return None
        track_id = self._clean_id(str(payload.get("id") or ""))
        if not track_id:
            return None
        attributes = payload.get("attributes") if isinstance(payload.get("attributes"), dict) else {}
        genre = self._first_text(attributes.get("genreNames"))
        title_value = attributes.get("name") or attributes.get("title")
        title = title_value if isinstance(title_value, str) and title_value.strip() else "Untitled"
        track_url = attributes.get("url") if isinstance(attributes.get("url"), str) else None
        return ProviderTrack(
            provider_track_id=track_id,
            title=title,
            artist=attributes.get("artistName") if isinstance(attributes.get("artistName"), str) else None,
            genre=genre,
            artwork_url=self._format_artwork_url(attributes.get("artwork")),
            url=track_url,
        )

    async def list_playlists(self) -> Sequence[ProviderPlaylist]:
        playlists: list[ProviderPlaylist] = []
        next_url: str | None = "/v1/me/library/playlists"
        params: dict[str, Any] | None = {"limit": 100, "offset": 0}
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            headers = await self._headers()
            while next_url:
                response = await client.get(next_url, headers=headers, params=params)
                self._raise_for_status(response)
                payload = response.json()
                for item in self._extract_data_list(payload):
                    mapped = self._to_provider_playlist(item)
                    if mapped:
                        playlists.append(mapped)
                next_url = self._next_url_from_payload(payload)
                params = None
        return playlists

    async def get_playlist(self, provider_playlist_id: str) -> ProviderPlaylist:
        playlist_id = self._normalize_playlist_id(provider_playlist_id)
        if not playlist_id:
            raise ProviderAPIError("Playlist id is required", status_code=400)
        if playlist_id.startswith("pl."):
            return await self._get_catalog_playlist(playlist_id)

        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"/v1/me/library/playlists/{playlist_id}",
                headers=await self._headers(),
            )
            self._raise_for_status(response)
            payload = response.json()
        mapped_playlist = None
        for item in self._extract_data_list(payload):
            mapped_playlist = self._to_provider_playlist(item)
            if mapped_playlist:
                break
        if not mapped_playlist:
            raise ProviderAPIError("Unable to load playlist", status_code=404)
        return mapped_playlist

    async def _get_catalog_playlist(self, playlist_id: str) -> ProviderPlaylist:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"/v1/catalog/{self.storefront}/playlists/{playlist_id}",
                headers=await self._headers(),
            )
            self._raise_for_status(response)
            payload = response.json()
        mapped_playlist = None
        for item in self._extract_data_list(payload):
            mapped_playlist = self._to_provider_playlist(item)
            if mapped_playlist:
                break
        if not mapped_playlist:
            raise ProviderAPIError("Unable to load playlist", status_code=404)
        return mapped_playlist

    async def search_playlists(self, query: str, limit: int = 10) -> Sequence[ProviderPlaylist]:
        search_query = query.strip()
        if not search_query:
            return []
        safe_limit = max(1, min(limit, 25))
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(
                "/v1/me/library/search",
                headers=await self._headers(),
                params={
                    "term": search_query,
                    "types": "library-playlists",
                    "limit": safe_limit,
                    "offset": 0,
                },
            )
            self._raise_for_status(response)
            payload = response.json()
        if not isinstance(payload, dict):
            return []
        results = payload.get("results")
        if not isinstance(results, dict):
            return []
        playlist_container = results.get("library-playlists")
        if not isinstance(playlist_container, dict):
            return []
        items = playlist_container.get("data")
        if not isinstance(items, list):
            return []
        playlists: list[ProviderPlaylist] = []
        for item in items:
            mapped = self._to_provider_playlist(item)
            if mapped:
                playlists.append(mapped)
        return playlists

    async def resolve_playlist_url(self, url: str) -> ProviderPlaylist:
        playlist_url = url.strip()
        if not playlist_url:
            raise ProviderAPIError("Playlist URL is required", status_code=400)
        playlist_id = self._normalize_playlist_id(playlist_url)
        if not playlist_id:
            raise ProviderAPIError("Resolved URL is not a playlist", status_code=400)
        return await self.get_playlist(playlist_id)

    async def create_playlist(
        self,
        title: str,
        description: str | None = None,
        is_public: bool | None = None,
    ) -> ProviderPlaylist:
        payload = {
            "attributes": {
                "name": title,
                "description": description or "",
            }
        }
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(
                "/v1/me/library/playlists",
                headers=await self._headers(),
                json=payload,
            )
            self._raise_for_status(response)
            body = response.json()
        mapped_playlist = None
        for item in self._extract_data_list(body):
            mapped_playlist = self._to_provider_playlist(item)
            if mapped_playlist:
                break
        if not mapped_playlist:
            raise ProviderAPIError("Unable to create playlist", status_code=502)
        return ProviderPlaylist(
            provider=mapped_playlist.provider,
            provider_playlist_id=mapped_playlist.provider_playlist_id,
            title=mapped_playlist.title or title,
            description=mapped_playlist.description if mapped_playlist.description is not None else description,
            image_url=mapped_playlist.image_url,
            url=mapped_playlist.url,
            track_count=mapped_playlist.track_count,
            is_public=bool(is_public) if is_public is not None else mapped_playlist.is_public,
        )

    async def list_tracks(self, provider_playlist_id: str) -> Sequence[ProviderTrack]:
        playlist_id = self._normalize_playlist_id(provider_playlist_id)
        if not playlist_id:
            raise ProviderAPIError("Playlist id is required", status_code=400)
        tracks: list[ProviderTrack] = []
        next_url: str | None = f"/v1/me/library/playlists/{playlist_id}/tracks"
        params: dict[str, Any] | None = {"limit": 100, "offset": 0}
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            headers = await self._headers()
            while next_url:
                response = await client.get(next_url, headers=headers, params=params)
                self._raise_for_status(response)
                payload = response.json()
                for item in self._extract_data_list(payload):
                    mapped = self._to_provider_track(item)
                    if mapped:
                        tracks.append(mapped)
                next_url = self._next_url_from_payload(payload)
                params = None
        return tracks

    async def add_tracks(self, provider_playlist_id: str, track_ids: Sequence[str]) -> None:
        playlist_id = self._normalize_playlist_id(provider_playlist_id)
        if not playlist_id:
            raise ProviderAPIError("Playlist id is required", status_code=400)
        data_items: list[dict[str, str]] = []
        seen: set[tuple[str, str]] = set()
        for track_id in track_ids:
            normalized = self._normalize_track_ref(str(track_id))
            if not normalized:
                continue
            normalized_id, normalized_type = normalized
            key = (normalized_id, normalized_type)
            if key in seen:
                continue
            seen.add(key)
            data_items.append({"id": normalized_id, "type": normalized_type})
        if not data_items:
            return
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"/v1/me/library/playlists/{playlist_id}/tracks",
                headers=await self._headers(),
                json={"data": data_items},
            )
            self._raise_for_status(response)

    async def remove_tracks(self, provider_playlist_id: str, track_ids: Sequence[str]) -> None:
        raise ProviderAPIError(
            "Apple Music track removal is not supported for library playlists",
            status_code=501,
        )

    async def shuffle_playlist(self, provider_playlist_id: str, *, max_items: int = 500) -> ProviderShuffleResult:
        raise ProviderAPIError(
            "Apple Music playlist shuffling is not supported for library playlists",
            status_code=501,
        )

    async def search_tracks(self, query: str, limit: int = 10) -> Sequence[ProviderTrack]:
        search_query = query.strip()
        if not search_query:
            return []
        safe_limit = max(1, min(limit, 25))
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"/v1/catalog/{self.storefront}/search",
                headers=await self._headers(),
                params={
                    "term": search_query,
                    "types": "songs",
                    "limit": safe_limit,
                    "offset": 0,
                },
            )
            self._raise_for_status(response)
            payload = response.json()
        if not isinstance(payload, dict):
            return []
        results = payload.get("results")
        if not isinstance(results, dict):
            return []
        songs = results.get("songs")
        if not isinstance(songs, dict):
            return []
        items = songs.get("data")
        if not isinstance(items, list):
            return []
        tracks: list[ProviderTrack] = []
        for item in items:
            mapped = self._to_provider_track(item)
            if mapped:
                tracks.append(mapped)
        return tracks

    async def related_tracks(
        self,
        provider_track_id: str,
        limit: int = 25,
        offset: int = 0,
    ) -> Sequence[ProviderTrack]:
        return []

    async def resolve_track_url(self, url: str) -> ProviderTrack:
        track_ref = url.strip()
        if not track_ref:
            raise ProviderAPIError("Track URL is required", status_code=400)
        normalized = self._normalize_track_ref(track_ref)
        if not normalized:
            raise ProviderAPIError("Resolved URL is not a track", status_code=400)
        track_id, track_type = normalized

        if track_type in {"library-songs", "library-music-videos"}:
            endpoint = "songs" if track_type == "library-songs" else "music-videos"
            request_path = f"/v1/me/library/{endpoint}/{track_id}"
        else:
            endpoint = "songs" if track_type == "songs" else "music-videos"
            request_path = f"/v1/catalog/{self.storefront}/{endpoint}/{track_id}"

        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(request_path, headers=await self._headers())
            self._raise_for_status(response)
            payload = response.json()
        mapped_track = None
        for item in self._extract_data_list(payload):
            mapped_track = self._to_provider_track(item)
            if mapped_track:
                break
        if not mapped_track:
            raise ProviderAPIError("Unable to resolve track URL", status_code=404)
        return mapped_track

    async def search_users(self, query: str, limit: int = 10) -> Sequence[ProviderUser]:
        return []

    async def get_user(self, provider_user_id: str) -> ProviderUser:
        raise ProviderAPIError(
            "Apple Music user lookup is not supported",
            status_code=501,
        )
