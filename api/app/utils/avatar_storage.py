"""Helpers for storing and serving user avatar files."""
from __future__ import annotations

from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
from uuid import uuid4

import httpx
from fastapi import HTTPException, UploadFile, status

from app.config.settings import settings

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _base_dir() -> Path:
    """Return the base directory for user file storage."""
    base = Path(__file__).resolve().parents[2]
    configured = Path(settings.USER_FILES_DIR)
    return configured if configured.is_absolute() else base / configured


def _avatar_dir() -> Path:
    """Return the directory for avatar storage, creating it if needed."""
    avatar_dir = _base_dir() / "avatars"
    avatar_dir.mkdir(parents=True, exist_ok=True)
    return avatar_dir


def _relative_avatar_path(path: Path) -> str:
    """Return a storage-relative path string for a saved avatar."""
    return path.relative_to(_base_dir()).as_posix()


def _resolve_avatar_path(relative_path: str) -> Path:
    """Resolve a storage-relative avatar path to an absolute path."""
    candidate = (_base_dir() / relative_path).resolve()
    if not str(candidate).startswith(str(_base_dir().resolve())):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid avatar path")
    return candidate


def _extension_from_content_type(content_type: str | None, fallback: str) -> str:
    """Return a file extension for the given content type."""
    if content_type and content_type in ALLOWED_CONTENT_TYPES:
        return ALLOWED_CONTENT_TYPES[content_type]
    if fallback:
        return fallback
    return ".jpg"


def _new_avatar_filename(user_id: int, extension: str) -> str:
    """Generate a new avatar filename for the user."""
    return f"user-{user_id}-{uuid4().hex}{extension}"


def delete_avatar_if_exists(relative_path: str | None) -> None:
    """Remove the previously stored avatar file if it exists."""
    if not relative_path:
        return
    try:
        path = _resolve_avatar_path(relative_path)
    except HTTPException:
        return
    if path.exists():
        path.unlink()


async def save_avatar_upload(upload: UploadFile, user_id: int) -> str:
    """Store an uploaded avatar and return its storage-relative path."""
    content_type = upload.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported avatar type")

    filename_ext = Path(upload.filename or "").suffix.lower()
    extension = _extension_from_content_type(content_type, filename_ext)
    avatar_dir = _avatar_dir()
    destination = avatar_dir / _new_avatar_filename(user_id, extension)

    data = await upload.read()
    await upload.close()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Avatar file is empty")
    if len(data) > settings.MAX_AVATAR_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Avatar file is too large")

    destination.write_bytes(data)
    return _relative_avatar_path(destination)


async def save_avatar_from_url(avatar_url: str, user_id: int) -> Optional[str]:
    """Download a remote avatar and store it locally."""
    if not avatar_url:
        return None

    avatar_dir = _avatar_dir()
    path_suffix = Path(urlparse(avatar_url).path).suffix.lower()

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            response = await client.get(avatar_url)
            if response.status_code != 200:
                return None
            content_type = response.headers.get("content-type", "").split(";")[0]
            if not content_type.startswith("image/"):
                return None
            data = response.content
    except httpx.HTTPError:
        return None

    if len(data) > settings.MAX_AVATAR_BYTES:
        return None

    extension = _extension_from_content_type(content_type, path_suffix)
    destination = avatar_dir / _new_avatar_filename(user_id, extension)
    destination.write_bytes(data)
    return _relative_avatar_path(destination)


def get_avatar_file_path(relative_path: str) -> Path:
    """Resolve a stored avatar path for file responses."""
    return _resolve_avatar_path(relative_path)
