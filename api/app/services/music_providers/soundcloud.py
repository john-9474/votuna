"""SoundCloud provider integration."""

from typing import Any, Sequence
from urllib.parse import urlparse
import httpx

from app.config.settings import settings
from app.services.music_providers.base import (
    MusicProviderClient,
    ProviderPlaylist,
    ProviderTrack,
    ProviderUser,
    ProviderAuthError,
    ProviderAPIError,
)


class SoundcloudProvider(MusicProviderClient):
    provider = "soundcloud"

    def __init__(self, access_token: str):
        super().__init__(access_token)
        self.base_url = settings.SOUNDCLOUD_API_BASE_URL or "https://api.soundcloud.com"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
        }

    def _params(self) -> dict[str, str]:
        return {}

    def _raise_for_status(self, response: httpx.Response) -> None:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code in {401, 403}:
                raise ProviderAuthError("SoundCloud authorization expired or invalid") from exc
            raise ProviderAPIError(
                f"SoundCloud API error ({status_code})",
                status_code=status_code,
            ) from exc

    @staticmethod
    def _normalize_track_urn(value: str) -> str | None:
        raw_value = value.strip()
        if not raw_value:
            return None
        lowered = raw_value.lower()
        if lowered.startswith("urn:soundcloud:tracks:"):
            track_part = raw_value.split(":", 3)[-1].strip()
            return f"urn:soundcloud:tracks:{track_part}" if track_part else None
        if lowered.startswith("soundcloud:tracks:"):
            track_part = raw_value.split(":", 2)[-1].strip()
            return f"urn:soundcloud:tracks:{track_part}" if track_part else None
        return None

    @classmethod
    def _normalize_track_id(cls, value: str) -> str | None:
        raw_value = value.strip()
        if not raw_value:
            return None
        normalized_urn = cls._normalize_track_urn(raw_value)
        if normalized_urn:
            return normalized_urn.rsplit(":", 1)[-1].strip() or None
        if raw_value.startswith("http://") or raw_value.startswith("https://"):
            parsed = urlparse(raw_value)
            segments = [segment for segment in parsed.path.split("/") if segment]
            if len(segments) >= 2 and segments[-2] == "tracks":
                track_part = segments[-1].strip()
                return track_part or None
        return raw_value

    @classmethod
    def _track_reference_key(cls, value: str) -> str:
        normalized_urn = cls._normalize_track_urn(value)
        if normalized_urn:
            return normalized_urn.rsplit(":", 1)[-1].strip().lower()
        normalized_id = cls._normalize_track_id(value) or value.strip()
        return normalized_id.lower()

    @classmethod
    def _build_track_reference(cls, value: str) -> tuple[dict[str, str], str] | None:
        raw_value = value.strip()
        if not raw_value:
            return None
        normalized_urn = cls._normalize_track_urn(raw_value)
        if normalized_urn:
            return {"urn": normalized_urn}, cls._track_reference_key(normalized_urn)
        normalized_id = cls._normalize_track_id(raw_value)
        if not normalized_id:
            return None
        return {"id": normalized_id}, cls._track_reference_key(normalized_id)

    @classmethod
    def _extract_track_reference_from_payload(cls, payload: Any) -> tuple[dict[str, str], str] | None:
        if not isinstance(payload, dict):
            return None
        urn_value = payload.get("urn")
        if isinstance(urn_value, str):
            normalized_urn = cls._normalize_track_urn(urn_value)
            if normalized_urn:
                return {"urn": normalized_urn}, cls._track_reference_key(normalized_urn)
        track_id = payload.get("id")
        if track_id is None:
            return None
        normalized_id = cls._normalize_track_id(str(track_id))
        if not normalized_id:
            return None
        return {"id": normalized_id}, cls._track_reference_key(normalized_id)

    def _to_provider_track(self, payload: Any) -> ProviderTrack | None:
        if not isinstance(payload, dict):
            return None
        track_ref = self._extract_track_reference_from_payload(payload)
        if not track_ref:
            return None
        track_id_value = track_ref[0]["urn"] if "urn" in track_ref[0] else track_ref[0]["id"]
        user_payload = payload.get("user")
        user = user_payload if isinstance(user_payload, dict) else {}
        return ProviderTrack(
            provider_track_id=track_id_value,
            title=payload.get("title") or "Untitled",
            artist=user.get("username"),
            genre=payload.get("genre"),
            artwork_url=payload.get("artwork_url") or user.get("avatar_url"),
            url=payload.get("permalink_url"),
        )

    def _to_provider_playlist(self, payload: Any) -> ProviderPlaylist | None:
        if not isinstance(payload, dict):
            return None
        playlist_id = payload.get("id")
        if playlist_id is None:
            return None
        user_payload = payload.get("user")
        user = user_payload if isinstance(user_payload, dict) else {}
        sharing = payload.get("sharing")
        is_public = None
        if isinstance(sharing, str):
            is_public = sharing.lower() == "public"
        return ProviderPlaylist(
            provider=self.provider,
            provider_playlist_id=str(playlist_id),
            title=payload.get("title") or "Untitled",
            description=payload.get("description"),
            image_url=payload.get("artwork_url") or user.get("avatar_url"),
            track_count=payload.get("track_count"),
            is_public=is_public,
        )

    def _to_provider_user(self, payload: Any) -> ProviderUser | None:
        if not isinstance(payload, dict):
            return None
        user_id = payload.get("id")
        if user_id is None:
            return None
        display_name = payload.get("username")
        handle = payload.get("permalink")
        first_name = payload.get("first_name")
        last_name = payload.get("last_name")
        full_name = " ".join(part for part in [first_name, last_name] if part) or None
        return ProviderUser(
            provider_user_id=str(user_id),
            # SoundCloud "permalink" is the profile handle used in URLs (what we show as @handle).
            username=handle or None,
            # SoundCloud "username" is the display name.
            display_name=display_name or full_name or handle,
            avatar_url=payload.get("avatar_url"),
            profile_url=payload.get("permalink_url"),
        )

    def _extract_handle_query(self, query: str) -> str | None:
        value = query.strip()
        if not value:
            return None
        if value.startswith("@"):
            value = value[1:].strip()
        elif value.startswith("http://") or value.startswith("https://"):
            parsed = urlparse(value)
            if "soundcloud.com" not in (parsed.netloc or ""):
                return None
            segments = [segment for segment in parsed.path.split("/") if segment]
            if not segments:
                return None
            value = segments[0]
        elif "soundcloud.com/" in value:
            try:
                parsed = urlparse(f"https://{value}")
                segments = [segment for segment in parsed.path.split("/") if segment]
                if not segments:
                    return None
                value = segments[0]
            except Exception:
                return None
        value = value.strip()
        if not value or "/" in value or " " in value:
            return None
        return value

    async def _resolve_user_by_handle(self, handle: str) -> ProviderUser | None:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15, follow_redirects=True) as client:
            response = await client.get(
                "/resolve",
                headers=self._headers(),
                params={
                    **self._params(),
                    "url": f"https://soundcloud.com/{handle}",
                },
            )
            try:
                self._raise_for_status(response)
            except ProviderAPIError as exc:
                if exc.status_code in {400, 404}:
                    return None
                raise
            payload = response.json()
        if not isinstance(payload, dict):
            return None
        kind = payload.get("kind")
        if kind and kind != "user":
            return None
        return self._to_provider_user(payload)

    async def list_playlists(self) -> Sequence[ProviderPlaylist]:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                "/me/playlists",
                headers=self._headers(),
                params=self._params(),
            )
            self._raise_for_status(response)
            data = response.json()
        playlists: list[ProviderPlaylist] = []
        for item in data or []:
            mapped = self._to_provider_playlist(item)
            if mapped:
                playlists.append(mapped)
        return playlists

    async def get_playlist(self, provider_playlist_id: str) -> ProviderPlaylist:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                f"/playlists/{provider_playlist_id}",
                headers=self._headers(),
                params=self._params(),
            )
            self._raise_for_status(response)
            item = response.json()
        mapped = self._to_provider_playlist(item)
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
                "/playlists",
                headers=self._headers(),
                params={
                    **self._params(),
                    "q": search_query,
                    "limit": safe_limit,
                },
            )
            self._raise_for_status(response)
            payload = response.json()
        if not isinstance(payload, list):
            return []
        results: list[ProviderPlaylist] = []
        for item in payload:
            mapped = self._to_provider_playlist(item)
            if mapped:
                results.append(mapped)
        return results

    async def resolve_playlist_url(self, url: str) -> ProviderPlaylist:
        playlist_url = url.strip()
        if not playlist_url:
            raise ProviderAPIError("Playlist URL is required", status_code=400)
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                "/resolve",
                headers=self._headers(),
                params={
                    **self._params(),
                    "url": playlist_url,
                },
            )
            self._raise_for_status(response)
            payload = response.json()
        if not isinstance(payload, dict):
            raise ProviderAPIError("Unable to resolve playlist URL", status_code=404)
        kind = (payload.get("kind") or "").lower()
        if kind and kind not in {"playlist", "system-playlist"}:
            raise ProviderAPIError("Resolved URL is not a playlist", status_code=400)
        mapped = self._to_provider_playlist(payload)
        if not mapped:
            raise ProviderAPIError("Unable to resolve playlist URL", status_code=404)
        return mapped

    async def create_playlist(
        self,
        title: str,
        description: str | None = None,
        is_public: bool | None = None,
    ) -> ProviderPlaylist:
        payload = {
            "playlist": {
                "title": title,
                "description": description or "",
                "sharing": "public" if is_public else "private",
            }
        }
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.post(
                "/playlists",
                headers=self._headers(),
                params=self._params(),
                json=payload,
            )
            self._raise_for_status(response)
            item = response.json()
        mapped = self._to_provider_playlist(item)
        if not mapped:
            raise ProviderAPIError("Unable to create playlist", status_code=502)
        return ProviderPlaylist(
            provider=mapped.provider,
            provider_playlist_id=mapped.provider_playlist_id,
            title=mapped.title or title,
            description=mapped.description if mapped.description is not None else description,
            image_url=mapped.image_url,
            track_count=mapped.track_count,
            is_public=mapped.is_public,
        )

    async def list_tracks(self, provider_playlist_id: str) -> Sequence[ProviderTrack]:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                f"/playlists/{provider_playlist_id}",
                headers=self._headers(),
                params=self._params(),
            )
            self._raise_for_status(response)
            payload = response.json()
        tracks = []
        for track in payload.get("tracks", []) or []:
            mapped_track = self._to_provider_track(track)
            if mapped_track:
                tracks.append(mapped_track)
        return tracks

    async def search_tracks(self, query: str, limit: int = 10) -> Sequence[ProviderTrack]:
        search_query = query.strip()
        if not search_query:
            return []
        safe_limit = max(1, min(limit, 25))
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                "/tracks",
                headers=self._headers(),
                params={
                    **self._params(),
                    "q": search_query,
                    "limit": safe_limit,
                },
            )
            self._raise_for_status(response)
            payload = response.json()
        results: list[ProviderTrack] = []
        if not isinstance(payload, list):
            return results
        for item in payload:
            mapped_track = self._to_provider_track(item)
            if mapped_track:
                results.append(mapped_track)
        return results

    async def related_tracks(
        self,
        provider_track_id: str,
        limit: int = 25,
        offset: int = 0,
    ) -> Sequence[ProviderTrack]:
        track_id = provider_track_id.strip()
        if not track_id:
            return []
        safe_limit = max(1, min(limit, 50))
        safe_offset = max(0, offset)
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                f"/tracks/{track_id}/related",
                headers=self._headers(),
                params={
                    **self._params(),
                    "limit": safe_limit,
                    "offset": safe_offset,
                    "linked_partitioning": 1,
                },
            )
            self._raise_for_status(response)
            payload = response.json()
        raw_items: list[Any]
        if isinstance(payload, list):
            raw_items = payload
        elif isinstance(payload, dict):
            collection = payload.get("collection")
            raw_items = collection if isinstance(collection, list) else []
        else:
            raw_items = []
        results: list[ProviderTrack] = []
        for item in raw_items:
            mapped_track = self._to_provider_track(item)
            if mapped_track:
                results.append(mapped_track)
        return results

    async def resolve_track_url(self, url: str) -> ProviderTrack:
        track_url = url.strip()
        if not track_url:
            raise ProviderAPIError("Track URL is required", status_code=400)
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                "/resolve",
                headers=self._headers(),
                params={
                    **self._params(),
                    "url": track_url,
                },
            )
            self._raise_for_status(response)
            payload = response.json()
        if not isinstance(payload, dict):
            raise ProviderAPIError("Unable to resolve track URL", status_code=404)
        kind = payload.get("kind")
        if kind and kind != "track":
            raise ProviderAPIError("Resolved URL is not a track", status_code=400)
        mapped_track = self._to_provider_track(payload)
        if not mapped_track:
            raise ProviderAPIError("Unable to resolve track URL", status_code=404)
        return mapped_track

    async def search_users(self, query: str, limit: int = 10) -> Sequence[ProviderUser]:
        search_query = query.strip()
        if not search_query:
            return []
        safe_limit = max(1, min(limit, 25))
        results: list[ProviderUser] = []
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
                response = await client.get(
                    "/users",
                    headers=self._headers(),
                    params={
                        **self._params(),
                        "q": search_query,
                        "limit": safe_limit,
                    },
                )
                self._raise_for_status(response)
                payload = response.json()
            if isinstance(payload, list):
                for item in payload:
                    mapped_user = self._to_provider_user(item)
                    if mapped_user:
                        results.append(mapped_user)
        except ProviderAuthError:
            raise
        except ProviderAPIError:
            # Keep invite lookup usable even when SoundCloud user search is flaky.
            pass

        handle_query = self._extract_handle_query(search_query)
        if handle_query:
            try:
                resolved_user = await self._resolve_user_by_handle(handle_query)
            except ProviderAuthError:
                raise
            except ProviderAPIError:
                resolved_user = None
            if resolved_user:
                existing_ids = {user.provider_user_id for user in results}
                if resolved_user.provider_user_id not in existing_ids:
                    results.insert(0, resolved_user)
        if len(results) > safe_limit:
            results = results[:safe_limit]
        return results

    async def get_user(self, provider_user_id: str) -> ProviderUser:
        user_id = provider_user_id.strip()
        if not user_id:
            raise ProviderAPIError("Provider user id is required", status_code=400)
        async with httpx.AsyncClient(base_url=self.base_url, timeout=15) as client:
            response = await client.get(
                f"/users/{user_id}",
                headers=self._headers(),
                params=self._params(),
            )
            self._raise_for_status(response)
            payload = response.json()
        mapped_user = self._to_provider_user(payload)
        if not mapped_user:
            raise ProviderAPIError("Provider user not found", status_code=404)
        return mapped_user

    async def add_tracks(self, provider_playlist_id: str, track_ids: Sequence[str]) -> None:
        if not track_ids:
            return
        # SoundCloud requires sending the full track list when updating playlists.
        async with httpx.AsyncClient(base_url=self.base_url, timeout=20) as client:
            response = await client.get(
                f"/playlists/{provider_playlist_id}",
                headers=self._headers(),
                params=self._params(),
            )
            self._raise_for_status(response)
            payload = response.json()
            existing_tracks = payload.get("tracks", []) or []
            existing_track_refs: list[dict[str, str]] = []
            existing_keys: set[str] = set()
            for track in existing_tracks:
                reference = self._extract_track_reference_from_payload(track)
                if not reference:
                    continue
                track_ref, track_key = reference
                if track_key in existing_keys:
                    continue
                existing_track_refs.append(track_ref)
                existing_keys.add(track_key)
            for track_id in track_ids:
                reference = self._build_track_reference(str(track_id))
                if not reference:
                    continue
                track_ref, track_key = reference
                if track_key in existing_keys:
                    continue
                existing_track_refs.append(track_ref)
                existing_keys.add(track_key)
            update_payload = {
                "playlist": {
                    "title": payload.get("title") or "Untitled",
                    "tracks": existing_track_refs,
                }
            }
            update_response = await client.put(
                f"/playlists/{provider_playlist_id}",
                headers=self._headers(),
                params=self._params(),
                json=update_payload,
            )
            self._raise_for_status(update_response)

    async def remove_tracks(self, provider_playlist_id: str, track_ids: Sequence[str]) -> None:
        if not track_ids:
            return
        remove_keys = {
            reference[1]
            for reference in (self._build_track_reference(str(track_id)) for track_id in track_ids)
            if reference
        }
        if not remove_keys:
            return
        async with httpx.AsyncClient(base_url=self.base_url, timeout=20) as client:
            response = await client.get(
                f"/playlists/{provider_playlist_id}",
                headers=self._headers(),
                params=self._params(),
            )
            self._raise_for_status(response)
            payload = response.json()
            existing_tracks = payload.get("tracks", []) or []
            kept_track_refs: list[dict[str, str]] = []
            seen_keys: set[str] = set()
            for track in existing_tracks:
                reference = self._extract_track_reference_from_payload(track)
                if not reference:
                    continue
                track_ref, track_key = reference
                if track_key in remove_keys or track_key in seen_keys:
                    continue
                kept_track_refs.append(track_ref)
                seen_keys.add(track_key)
            update_payload = {
                "playlist": {
                    "title": payload.get("title") or "Untitled",
                    "tracks": kept_track_refs,
                }
            }
            update_response = await client.put(
                f"/playlists/{provider_playlist_id}",
                headers=self._headers(),
                params=self._params(),
                json=update_payload,
            )
            self._raise_for_status(update_response)

    async def track_exists(self, provider_playlist_id: str, track_id: str) -> bool:
        track_reference = self._build_track_reference(track_id)
        if not track_reference:
            return False
        target_key = track_reference[1]
        tracks = await self.list_tracks(provider_playlist_id)
        return any(self._track_reference_key(track.provider_track_id) == target_key for track in tracks)
