"""Helpers for parsing provider token expiry fields."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Mapping


def parse_positive_seconds(value: Any) -> float | None:
    """Return a positive numeric duration in seconds when parseable."""
    if isinstance(value, (int, float)):
        seconds = float(value)
        return seconds if seconds > 0 else None
    if isinstance(value, str):
        try:
            seconds = float(value.strip())
        except ValueError:
            return None
        return seconds if seconds > 0 else None
    return None


def coerce_expires_at(value: Any) -> datetime | None:
    """Normalize token expiry values into a timezone-aware UTC datetime."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, (int, float)):
        seconds = float(value)
        if seconds <= 0:
            return None
        return datetime.fromtimestamp(seconds, tz=timezone.utc)
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            numeric = parse_positive_seconds(raw)
            if numeric is None:
                return None
            return datetime.fromtimestamp(numeric, tz=timezone.utc)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None


def expires_at_from_payload(payload: Mapping[str, Any] | None) -> datetime | None:
    """Derive an expiry datetime from OAuth token payload fields."""
    if not payload:
        return None
    expires_at = coerce_expires_at(payload.get("expires_at"))
    if expires_at is not None:
        return expires_at
    expires_in = parse_positive_seconds(payload.get("expires_in"))
    if expires_in is None:
        return None
    return datetime.now(timezone.utc) + timedelta(seconds=expires_in)
