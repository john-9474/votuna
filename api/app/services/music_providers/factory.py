"""Factory for music provider clients."""

from app.services.music_providers.base import MusicProviderClient
from app.services.music_providers.soundcloud import SoundcloudProvider


def get_music_provider(provider: str, access_token: str) -> MusicProviderClient:
    provider = provider.lower()
    if provider == "soundcloud":
        return SoundcloudProvider(access_token)
    raise ValueError(f"Unsupported provider: {provider}")
