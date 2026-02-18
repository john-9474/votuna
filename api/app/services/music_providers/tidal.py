"""TIDAL provider integration."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence
from urllib.parse import quote, urlparse
from uuid import UUID

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


@dataclass
class _TidalPlaylistItem:
    track: ProviderTrack
    item_id: str | None
    resource_type: str


class TidalProvider(MusicProviderClient):
    provider = "tidal"
    _REQUEST_TIMEOUT_SECONDS = 15
    _TRACK_TYPES = {"tracks", "videos"}

    def __init__(self, access_token: str):
        super().__init__(access_token)
        self.base_url = settings.TIDAL_API_BASE_URL or "https://openapi.tidal.com/v2"
        self.country_code = (settings.TIDAL_COUNTRY_CODE or "").strip()

    @staticmethod
    def _clean_id(value: str) -> str | None:
        cleaned = value.strip()
        return cleaned or None

    @staticmethod
    def _is_uuid(value: str) -> bool:
        try:
            UUID(value)
            return True
        except (TypeError, ValueError, AttributeError):
            return False

    @staticmethod
    def _extract_error_message(payload: Any) -> str | None:
        if isinstance(payload, dict):
            errors = payload.get("errors")
            if isinstance(errors, list):
                for error in errors:
                    if not isinstance(error, dict):
                        continue
                    detail = error.get("detail")
                    title = error.get("title")
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
                raise ProviderAuthError("TIDAL authorization expired or invalid") from exc

            detail_suffix = f": {provider_message}" if provider_message else ""
            if status_code == 429:
                raise ProviderAPIError(
                    f"TIDAL API rate limit exceeded (429){detail_suffix}",
                    status_code=status_code,
                ) from exc
            raise ProviderAPIError(
                f"TIDAL API error ({status_code}){detail_suffix}",
                status_code=status_code,
            ) from exc

    def _headers(self) -> dict[str, str]:
        token = (self.access_token or "").strip()
        if not token:
            raise ProviderAuthError("Missing TIDAL access token")
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
        }

    def _params(self) -> dict[str, str]:
        if not self.country_code:
            return {}
        return {"countryCode": self.country_code}

    @classmethod
    def _extract_id_from_url(cls, raw_url: str, resource: str) -> str | None:
        try:
            parsed = urlparse(raw_url)
        except Exception:
            return None
        host = (parsed.netloc or "").lower()
        if "tidal.com" not in host:
            return None
        segments = [segment for segment in parsed.path.split("/") if segment]
        if not segments:
            return None
        for index, segment in enumerate(segments):
            if segment.lower() != resource:
                continue
            if index + 1 >= len(segments):
                return None
            return cls._clean_id(segments[index + 1])
        return cls._clean_id(segments[-1])

    @classmethod
    def _normalize_playlist_id(cls, value: str) -> str | None:
        raw_value = value.strip()
        if not raw_value:
            return None
        lower = raw_value.lower()
        if lower.startswith("tidal:playlist:"):
            return cls._clean_id(raw_value.split(":", 2)[-1])
        if raw_value.startswith("http://") or raw_value.startswith("https://"):
            return cls._extract_id_from_url(raw_value, "playlist")
        if "tidal.com/" in lower:
            return cls._extract_id_from_url(f"https://{raw_value}", "playlist")
        return cls._clean_id(raw_value)

    @classmethod
    def _normalize_track_ref(cls, value: str) -> tuple[str, str] | None:
        raw_value = value.strip()
        if not raw_value:
            return None
        lower = raw_value.lower()

        if lower.startswith("tidal:"):
            parts = raw_value.split(":", 2)
            if len(parts) == 3 and parts[1].lower() in cls._TRACK_TYPES:
                track_id = cls._clean_id(parts[2])
                if track_id:
                    return track_id, parts[1].lower()

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
                return track_id, "tracks"
            return None
        if "tidal.com/" in lower:
            track_id = cls._extract_id_from_url(f"https://{raw_value}", "track")
            if track_id:
                return track_id, "tracks"
            return None

        track_id = cls._clean_id(raw_value)
        if not track_id:
            return None
        return track_id, "tracks"

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

    @classmethod
    def _extract_included_index(cls, payload: Any) -> dict[tuple[str, str], dict[str, Any]]:
        included_index: dict[tuple[str, str], dict[str, Any]] = {}
        if not isinstance(payload, dict):
            return included_index
        included = payload.get("included")
        if not isinstance(included, list):
            return included_index
        for item in included:
            if not isinstance(item, dict):
                continue
            item_type = item.get("type")
            item_id = item.get("id")
            if not isinstance(item_type, str) or not item_type.strip():
                continue
            if not isinstance(item_id, str) or not item_id.strip():
                continue
            included_index[(item_type.lower(), item_id)] = item
        return included_index

    @classmethod
    def _next_url_from_payload(cls, payload: Any) -> str | None:
        if not isinstance(payload, dict):
            return None
        raw_next = payload.get("next")
        if isinstance(raw_next, str) and raw_next.strip():
            return raw_next.strip()
        links = payload.get("links")
        if not isinstance(links, dict):
            return None
        next_link = links.get("next")
        if isinstance(next_link, str) and next_link.strip():
            return next_link.strip()
        if isinstance(next_link, dict):
            href = next_link.get("href")
            if isinstance(href, str) and href.strip():
                return href.strip()
        return None

    @classmethod
    def _relationship_entries(cls, resource: Any, relationship_name: str) -> list[dict[str, Any]]:
        if not isinstance(resource, dict):
            return []
        relationships = resource.get("relationships")
        if not isinstance(relationships, dict):
            return []
        relationship = relationships.get(relationship_name)
        if not isinstance(relationship, dict):
            return []
        data = relationship.get("data")
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        if isinstance(data, dict):
            return [data]
        return []

    @classmethod
    def _extract_external_url(cls, resource: Any, preferred_types: tuple[str, ...]) -> str | None:
        if not isinstance(resource, dict):
            return None
        attributes = resource.get("attributes")
        if not isinstance(attributes, dict):
            return None
        external_links = attributes.get("externalLinks")
        if not isinstance(external_links, list):
            return None

        normalized_preferred = {value.upper() for value in preferred_types}
        fallback_url = None
        for external_link in external_links:
            if not isinstance(external_link, dict):
                continue
            href = external_link.get("href")
            if not isinstance(href, str) or not href.strip():
                continue
            href = href.strip()
            if fallback_url is None:
                fallback_url = href
            meta = external_link.get("meta")
            external_type = meta.get("type") if isinstance(meta, dict) else None
            if isinstance(external_type, str) and external_type.upper() in normalized_preferred:
                return href
        return fallback_url

    @classmethod
    def _extract_artwork_url_from_artwork(cls, artwork_resource: Any) -> str | None:
        if not isinstance(artwork_resource, dict):
            return None
        attributes = artwork_resource.get("attributes")
        if not isinstance(attributes, dict):
            return None
        files = attributes.get("files")
        if not isinstance(files, list):
            return None
        for file_entry in files:
            if not isinstance(file_entry, dict):
                continue
            href = file_entry.get("href")
            if isinstance(href, str) and href.strip():
                return href.strip()
        return None

    @classmethod
    def _extract_artwork_from_resource(
        cls,
        resource: Any,
        included_index: dict[tuple[str, str], dict[str, Any]],
    ) -> str | None:
        if not isinstance(resource, dict):
            return None
        for relationship_name in ("coverArt", "artworks"):
            entries = cls._relationship_entries(resource, relationship_name)
            for entry in entries:
                artwork_type = entry.get("type")
                artwork_id = entry.get("id")
                if not isinstance(artwork_type, str) or not isinstance(artwork_id, str):
                    continue
                artwork = included_index.get((artwork_type.lower(), artwork_id))
                artwork_url = cls._extract_artwork_url_from_artwork(artwork)
                if artwork_url:
                    return artwork_url
        return None

    @classmethod
    def _extract_artist_names(
        cls,
        resource: Any,
        included_index: dict[tuple[str, str], dict[str, Any]],
    ) -> list[str]:
        names: list[str] = []
        seen: set[str] = set()
        for entry in cls._relationship_entries(resource, "artists"):
            artist_id = entry.get("id")
            artist_type = entry.get("type")
            if not isinstance(artist_id, str) or not isinstance(artist_type, str):
                continue
            artist_resource = included_index.get((artist_type.lower(), artist_id))
            attributes = artist_resource.get("attributes") if isinstance(artist_resource, dict) else {}
            artist_name = attributes.get("name") if isinstance(attributes, dict) else None
            if isinstance(artist_name, str) and artist_name.strip():
                normalized = artist_name.strip()
                key = normalized.lower()
                if key not in seen:
                    seen.add(key)
                    names.append(normalized)
        return names

    @classmethod
    def _extract_genre(
        cls,
        resource: Any,
        included_index: dict[tuple[str, str], dict[str, Any]],
    ) -> str | None:
        for entry in cls._relationship_entries(resource, "genres"):
            genre_type = entry.get("type")
            genre_id = entry.get("id")
            if not isinstance(genre_type, str) or not isinstance(genre_id, str):
                continue
            genre_resource = included_index.get((genre_type.lower(), genre_id))
            if not isinstance(genre_resource, dict):
                continue
            attributes = genre_resource.get("attributes")
            if not isinstance(attributes, dict):
                continue
            name = attributes.get("name")
            if isinstance(name, str) and name.strip():
                return name.strip()
        return None

    def _to_provider_playlist(
        self,
        resource: Any,
        included_index: dict[tuple[str, str], dict[str, Any]],
    ) -> ProviderPlaylist | None:
        if not isinstance(resource, dict):
            return None
        playlist_id = self._clean_id(str(resource.get("id") or ""))
        if not playlist_id:
            return None
        raw_attributes = resource.get("attributes")
        attributes = raw_attributes if isinstance(raw_attributes, dict) else {}
        title = attributes.get("name")
        raw_description = attributes.get("description")
        description = raw_description if isinstance(raw_description, str) else None
        raw_track_count = attributes.get("numberOfItems")
        track_count = raw_track_count if isinstance(raw_track_count, int) else None
        raw_access_type = attributes.get("accessType")
        access_type = raw_access_type if isinstance(raw_access_type, str) else None
        url = self._extract_external_url(
            resource,
            ("TIDAL_SHARING", "TIDAL_USER_SHARING", "TIDAL_AUTOPLAY_WEB"),
        )
        if not url:
            url = f"https://listen.tidal.com/playlist/{quote(playlist_id, safe='')}"
        return ProviderPlaylist(
            provider=self.provider,
            provider_playlist_id=playlist_id,
            title=title if isinstance(title, str) and title.strip() else "Untitled",
            description=description.strip() if isinstance(description, str) and description.strip() else None,
            image_url=self._extract_artwork_from_resource(resource, included_index),
            url=url,
            track_count=track_count,
            is_public=access_type.upper() == "PUBLIC" if isinstance(access_type, str) else None,
        )

    def _to_provider_track(
        self,
        resource: Any,
        included_index: dict[tuple[str, str], dict[str, Any]],
    ) -> ProviderTrack | None:
        if not isinstance(resource, dict):
            return None
        track_id = self._clean_id(str(resource.get("id") or ""))
        if not track_id:
            return None
        raw_attributes = resource.get("attributes")
        attributes = raw_attributes if isinstance(raw_attributes, dict) else {}
        title = attributes.get("title")
        version = attributes.get("version")
        if isinstance(version, str) and version.strip() and isinstance(title, str) and title.strip():
            title = f"{title.strip()} ({version.strip()})"
        if not isinstance(title, str) or not title.strip():
            title = "Untitled"

        artist_names = self._extract_artist_names(resource, included_index)
        artwork_url = self._extract_artwork_from_resource(resource, included_index)
        if not artwork_url:
            for album_entry in self._relationship_entries(resource, "albums"):
                album_id = album_entry.get("id")
                album_type = album_entry.get("type")
                if not isinstance(album_id, str) or not isinstance(album_type, str):
                    continue
                album_resource = included_index.get((album_type.lower(), album_id))
                artwork_url = self._extract_artwork_from_resource(album_resource, included_index)
                if artwork_url:
                    break

        track_type = str(resource.get("type") or "").lower()
        path_resource = "video" if track_type == "videos" else "track"
        track_url = self._extract_external_url(
            resource,
            ("TIDAL_SHARING", "TIDAL_AUTOPLAY_WEB", "TIDAL_AUTOPLAY_IOS", "TIDAL_AUTOPLAY_ANDROID"),
        )
        if not track_url:
            track_url = f"https://listen.tidal.com/{path_resource}/{quote(track_id, safe='')}"

        return ProviderTrack(
            provider_track_id=track_id,
            title=title.strip(),
            artist=", ".join(artist_names) if artist_names else None,
            genre=self._extract_genre(resource, included_index),
            artwork_url=artwork_url,
            url=track_url,
        )

    async def _fetch_current_user_id(self, client: httpx.AsyncClient) -> str:
        response = await client.get("/users/me", headers=self._headers())
        self._raise_for_status(response)
        payload = response.json()
        data_items = self._extract_data_list(payload)
        if not data_items:
            raise ProviderAPIError("Unable to fetch TIDAL user profile", status_code=502)
        user_id = self._clean_id(str(data_items[0].get("id") or ""))
        if not user_id:
            raise ProviderAPIError("Unable to fetch TIDAL user profile", status_code=502)
        return user_id

    async def list_playlists(self) -> Sequence[ProviderPlaylist]:
        playlists: list[ProviderPlaylist] = []
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            user_id = await self._fetch_current_user_id(client)
            next_url: str | None = "/playlists"
            params: dict[str, Any] | None = {
                **self._params(),
                "include": "coverArt",
                "filter[owners.id]": user_id,
            }
            while next_url:
                response = await client.get(next_url, headers=self._headers(), params=params)
                self._raise_for_status(response)
                payload = response.json()
                included_index = self._extract_included_index(payload)
                for item in self._extract_data_list(payload):
                    mapped = self._to_provider_playlist(item, included_index)
                    if mapped:
                        playlists.append(mapped)
                next_url = self._next_url_from_payload(payload)
                params = None
        return playlists

    async def get_playlist(self, provider_playlist_id: str) -> ProviderPlaylist:
        playlist_id = self._normalize_playlist_id(provider_playlist_id)
        if not playlist_id:
            raise ProviderAPIError("Playlist id is required", status_code=400)
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"/playlists/{playlist_id}",
                headers=self._headers(),
                params={
                    **self._params(),
                    "include": "coverArt",
                },
            )
            self._raise_for_status(response)
            payload = response.json()
        included_index = self._extract_included_index(payload)
        data = self._extract_data_list(payload)
        mapped = self._to_provider_playlist(data[0], included_index) if data else None
        if not mapped:
            raise ProviderAPIError("Unable to load playlist", status_code=404)
        return mapped

    async def search_playlists(self, query: str, limit: int = 10) -> Sequence[ProviderPlaylist]:
        search_query = query.strip()
        if not search_query:
            return []
        safe_limit = max(1, min(limit, 25))
        search_id = quote(search_query, safe="")
        results: list[ProviderPlaylist] = []
        seen_ids: set[str] = set()

        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"/searchResults/{search_id}",
                headers=self._headers(),
                params={
                    **self._params(),
                    "include": "playlists",
                },
            )
            self._raise_for_status(response)
            payload = response.json()
            included_index = self._extract_included_index(payload)
            included = payload.get("included")
            if isinstance(included, list):
                for item in included:
                    if not isinstance(item, dict):
                        continue
                    if str(item.get("type") or "").lower() != "playlists":
                        continue
                    mapped = self._to_provider_playlist(item, included_index)
                    if not mapped or mapped.provider_playlist_id in seen_ids:
                        continue
                    seen_ids.add(mapped.provider_playlist_id)
                    results.append(mapped)
                    if len(results) >= safe_limit:
                        return results

            relationship_response = await client.get(
                f"/searchResults/{search_id}/relationships/playlists",
                headers=self._headers(),
                params=self._params(),
            )
            self._raise_for_status(relationship_response)
            relationship_payload = relationship_response.json()
            for entry in self._extract_data_list(relationship_payload):
                playlist_id = self._clean_id(str(entry.get("id") or ""))
                if not playlist_id or playlist_id in seen_ids:
                    continue
                try:
                    playlist = await self.get_playlist(playlist_id)
                except ProviderAPIError:
                    continue
                seen_ids.add(playlist.provider_playlist_id)
                results.append(playlist)
                if len(results) >= safe_limit:
                    break
        return results

    async def resolve_playlist_url(self, url: str) -> ProviderPlaylist:
        playlist_ref = url.strip()
        if not playlist_ref:
            raise ProviderAPIError("Playlist URL is required", status_code=400)
        playlist_id = self._normalize_playlist_id(playlist_ref)
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
            "data": {
                "type": "playlists",
                "attributes": {
                    "name": title,
                    "description": description or "",
                    "accessType": "PUBLIC" if is_public else "UNLISTED",
                },
            }
        }
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(
                "/playlists",
                headers=self._headers(),
                params=self._params(),
                json=payload,
            )
            self._raise_for_status(response)
            body = response.json()
        included_index = self._extract_included_index(body)
        data = self._extract_data_list(body)
        mapped = self._to_provider_playlist(data[0], included_index) if data else None
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

    async def _list_playlist_items(
        self,
        client: httpx.AsyncClient,
        playlist_id: str,
        *,
        enrich_track_metadata: bool = False,
    ) -> list[_TidalPlaylistItem]:
        items: list[_TidalPlaylistItem] = []
        next_url: str | None = f"/playlists/{playlist_id}/relationships/items"
        params: dict[str, Any] | None = {
            **self._params(),
            "include": "tracks,videos,artists,albums,albums.coverArt",
        }
        while next_url:
            response = await client.get(next_url, headers=self._headers(), params=params)
            self._raise_for_status(response)
            payload = response.json()
            included_index = self._extract_included_index(payload)
            for entry in self._extract_data_list(payload):
                resource_id = self._clean_id(str(entry.get("id") or ""))
                resource_type = str(entry.get("type") or "").lower()
                if not resource_id or resource_type not in self._TRACK_TYPES:
                    continue
                resource = included_index.get((resource_type, resource_id))
                mapped_track = self._to_provider_track(resource or entry, included_index)
                if (
                    enrich_track_metadata
                    and (not isinstance(resource, dict) or not isinstance(resource.get("attributes"), dict))
                ):
                    try:
                        mapped_track = await self._get_track(resource_id, resource_type)
                    except ProviderAPIError:
                        pass
                if not mapped_track:
                    mapped_track = ProviderTrack(
                        provider_track_id=resource_id,
                        title=resource_id,
                        artist=None,
                        genre=None,
                        artwork_url=None,
                        url=f"https://listen.tidal.com/{'video' if resource_type == 'videos' else 'track'}/{resource_id}",
                    )
                raw_meta = entry.get("meta")
                meta = raw_meta if isinstance(raw_meta, dict) else {}
                raw_item_id = meta.get("itemId")
                item_id = raw_item_id.strip() if isinstance(raw_item_id, str) and raw_item_id.strip() else None
                items.append(
                    _TidalPlaylistItem(
                        track=mapped_track,
                        item_id=item_id,
                        resource_type=resource_type,
                    )
                )
            next_url = self._next_url_from_payload(payload)
            params = None
        return items

    async def list_tracks(self, provider_playlist_id: str) -> Sequence[ProviderTrack]:
        playlist_id = self._normalize_playlist_id(provider_playlist_id)
        if not playlist_id:
            raise ProviderAPIError("Playlist id is required", status_code=400)
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            playlist_items = await self._list_playlist_items(client, playlist_id, enrich_track_metadata=True)
        return [item.track for item in playlist_items]

    async def add_tracks(self, provider_playlist_id: str, track_ids: Sequence[str]) -> None:
        playlist_id = self._normalize_playlist_id(provider_playlist_id)
        if not playlist_id:
            raise ProviderAPIError("Playlist id is required", status_code=400)
        payload_data: list[dict[str, str]] = []
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
            payload_data.append({"id": normalized_id, "type": normalized_type})
        if not payload_data:
            return

        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            playlist_items = await self._list_playlist_items(client, playlist_id)
            first_item_id = next((item.item_id for item in playlist_items if item.item_id), None)
            request_payload: dict[str, Any] = {"data": payload_data}
            if first_item_id and self._is_uuid(first_item_id):
                request_payload["meta"] = {"positionBefore": first_item_id}
            response = await client.post(
                f"/playlists/{playlist_id}/relationships/items",
                headers=self._headers(),
                params=self._params(),
                json=request_payload,
            )
            self._raise_for_status(response)

    async def remove_tracks(self, provider_playlist_id: str, track_ids: Sequence[str]) -> None:
        playlist_id = self._normalize_playlist_id(provider_playlist_id)
        if not playlist_id:
            raise ProviderAPIError("Playlist id is required", status_code=400)
        remove_refs: set[tuple[str, str]] = set()
        for track_id in track_ids:
            normalized = self._normalize_track_ref(str(track_id))
            if normalized:
                remove_refs.add(normalized)
        if not remove_refs:
            return

        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            playlist_items = await self._list_playlist_items(client, playlist_id)
            payload_data: list[dict[str, Any]] = []
            for item in playlist_items:
                key = (item.track.provider_track_id, item.resource_type)
                if key not in remove_refs:
                    continue
                if not item.item_id:
                    continue
                payload_data.append(
                    {
                        "id": item.track.provider_track_id,
                        "type": item.resource_type,
                        "meta": {"itemId": item.item_id},
                    }
                )
            if not payload_data:
                return
            response = await client.request(
                "DELETE",
                f"/playlists/{playlist_id}/relationships/items",
                headers=self._headers(),
                json={"data": payload_data},
            )
            self._raise_for_status(response)

    async def search_tracks(
        self,
        query: str,
        limit: int = 10,
        *,
        hydrate_metadata: bool = True,
    ) -> Sequence[ProviderTrack]:
        search_query = query.strip()
        if not search_query:
            return []
        safe_limit = max(1, min(limit, 25))
        search_id = quote(search_query, safe="")
        results: list[ProviderTrack] = []
        seen_ids: set[str] = set()

        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"/searchResults/{search_id}",
                headers=self._headers(),
                params={
                    **self._params(),
                    "include": "tracks,artists,albums,albums.coverArt",
                },
            )
            self._raise_for_status(response)
            payload = response.json()
            included_index = self._extract_included_index(payload)
            included = payload.get("included")
            missing_track_metadata_ids: list[str] = []
            candidate_tracks: list[tuple[ProviderTrack, str, bool]] = []
            if isinstance(included, list):
                for item in included:
                    if not isinstance(item, dict):
                        continue
                    item_type = str(item.get("type") or "").lower()
                    if item_type not in self._TRACK_TYPES:
                        continue
                    mapped = self._to_provider_track(item, included_index)
                    if not mapped:
                        continue
                    needs_metadata = mapped.artist is None or mapped.artwork_url is None
                    if hydrate_metadata and needs_metadata and item_type == "tracks":
                        missing_track_metadata_ids.append(mapped.provider_track_id)
                    candidate_tracks.append((mapped, item_type, needs_metadata))

            hydrated_tracks: dict[str, ProviderTrack] = {}
            if hydrate_metadata and missing_track_metadata_ids:
                try:
                    hydrated_tracks = await self._get_tracks_bulk(missing_track_metadata_ids)
                except ProviderAPIError:
                    hydrated_tracks = {}

            for mapped, item_type, needs_metadata in candidate_tracks:
                hydrated = hydrated_tracks.get(mapped.provider_track_id)
                if hydrated:
                    mapped = hydrated
                elif hydrate_metadata and needs_metadata and item_type != "tracks":
                    try:
                        mapped = await self._get_track(mapped.provider_track_id, item_type)
                    except ProviderAPIError:
                        pass
                if mapped.provider_track_id in seen_ids:
                    continue
                seen_ids.add(mapped.provider_track_id)
                results.append(mapped)
                if len(results) >= safe_limit:
                    return results

            if not hydrate_metadata:
                return results

            relationship_response = await client.get(
                f"/searchResults/{search_id}/relationships/tracks",
                headers=self._headers(),
                params=self._params(),
            )
            self._raise_for_status(relationship_response)
            relationship_payload = relationship_response.json()
            for entry in self._extract_data_list(relationship_payload):
                track_id = self._clean_id(str(entry.get("id") or ""))
                if not track_id or track_id in seen_ids:
                    continue
                if hydrate_metadata:
                    try:
                        track = await self._get_track(track_id, "tracks")
                    except ProviderAPIError:
                        continue
                    seen_ids.add(track.provider_track_id)
                    results.append(track)
                else:
                    seen_ids.add(track_id)
                    results.append(
                        ProviderTrack(
                            provider_track_id=track_id,
                            title=track_id,
                            artist=None,
                            genre=None,
                            artwork_url=None,
                            url=f"https://listen.tidal.com/track/{quote(track_id, safe='')}",
                        )
                    )
                if len(results) >= safe_limit:
                    break
        return results

    async def _get_tracks_bulk(self, track_ids: Sequence[str]) -> dict[str, ProviderTrack]:
        normalized_ids: list[str] = []
        seen_ids: set[str] = set()
        for track_id in track_ids:
            normalized_track_id = self._clean_id(str(track_id))
            if not normalized_track_id or normalized_track_id in seen_ids:
                continue
            seen_ids.add(normalized_track_id)
            normalized_ids.append(normalized_track_id)
        if not normalized_ids:
            return {}

        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(
                "/tracks",
                headers=self._headers(),
                params={
                    **self._params(),
                    "filter[id]": ",".join(normalized_ids),
                    "include": "artists,albums,albums.coverArt",
                },
            )
            self._raise_for_status(response)
            payload = response.json()

        included_index = self._extract_included_index(payload)
        hydrated: dict[str, ProviderTrack] = {}
        for item in self._extract_data_list(payload):
            mapped = self._to_provider_track(item, included_index)
            if mapped:
                hydrated[mapped.provider_track_id] = mapped
        return hydrated

    async def related_tracks(
        self,
        provider_track_id: str,
        limit: int = 25,
        offset: int = 0,
    ) -> Sequence[ProviderTrack]:
        track_id = self._clean_id(provider_track_id)
        if not track_id:
            return []
        safe_limit = max(1, min(limit, 50))
        safe_offset = max(0, offset)
        next_url: str | None = f"/tracks/{track_id}/relationships/similarTracks"
        params: dict[str, Any] | None = {
            **self._params(),
            "include": "tracks,artists,albums,albums.coverArt",
        }
        results: list[ProviderTrack] = []
        collected = 0
        skipped = 0
        seen_ids: set[str] = set()
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            while next_url and collected < safe_limit:
                response = await client.get(next_url, headers=self._headers(), params=params)
                self._raise_for_status(response)
                payload = response.json()
                included_index = self._extract_included_index(payload)
                missing_track_metadata_ids: list[str] = []
                candidate_tracks: list[tuple[ProviderTrack, str, bool]] = []
                for entry in self._extract_data_list(payload):
                    item_type = str(entry.get("type") or "").lower()
                    if item_type not in self._TRACK_TYPES:
                        continue
                    item_id = self._clean_id(str(entry.get("id") or ""))
                    if not item_id or item_id in seen_ids:
                        continue
                    seen_ids.add(item_id)
                    resource = included_index.get((item_type, item_id))
                    mapped = self._to_provider_track(resource or entry, included_index)
                    if not mapped:
                        continue
                    needs_metadata = mapped.artist is None or mapped.artwork_url is None
                    if needs_metadata and item_type == "tracks":
                        missing_track_metadata_ids.append(mapped.provider_track_id)
                    candidate_tracks.append((mapped, item_type, needs_metadata))

                hydrated_tracks: dict[str, ProviderTrack] = {}
                if missing_track_metadata_ids:
                    try:
                        hydrated_tracks = await self._get_tracks_bulk(missing_track_metadata_ids)
                    except ProviderAPIError:
                        hydrated_tracks = {}

                for mapped, item_type, needs_metadata in candidate_tracks:
                    hydrated = hydrated_tracks.get(mapped.provider_track_id)
                    if hydrated:
                        mapped = hydrated
                    elif needs_metadata and item_type != "tracks":
                        try:
                            mapped = await self._get_track(mapped.provider_track_id, item_type)
                        except ProviderAPIError:
                            pass
                    if skipped < safe_offset:
                        skipped += 1
                        continue
                    results.append(mapped)
                    collected += 1
                    if collected >= safe_limit:
                        break
                next_url = self._next_url_from_payload(payload)
                params = None
        return results

    async def _get_track(self, track_id: str, track_type: str) -> ProviderTrack:
        resource_name = "videos" if track_type == "videos" else "tracks"
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"/{resource_name}/{track_id}",
                headers=self._headers(),
                params={
                    **self._params(),
                    "include": "artists,albums,albums.coverArt",
                },
            )
            self._raise_for_status(response)
            payload = response.json()
        included_index = self._extract_included_index(payload)
        data = self._extract_data_list(payload)
        mapped = self._to_provider_track(data[0], included_index) if data else None
        if not mapped:
            raise ProviderAPIError("Unable to load track", status_code=404)
        return mapped

    async def resolve_track_url(self, url: str) -> ProviderTrack:
        track_ref = url.strip()
        if not track_ref:
            raise ProviderAPIError("Track URL is required", status_code=400)
        normalized = self._normalize_track_ref(track_ref)
        if not normalized:
            raise ProviderAPIError("Resolved URL is not a track", status_code=400)
        track_id, track_type = normalized
        return await self._get_track(track_id, track_type)

    async def search_users(self, query: str, limit: int = 10) -> Sequence[ProviderUser]:
        return []

    async def get_user(self, provider_user_id: str) -> ProviderUser:
        raise ProviderAPIError(
            "TIDAL user lookup is not supported",
            status_code=501,
        )
