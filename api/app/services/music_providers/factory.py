"""Factory for music provider clients."""

from app.services.music_providers.base import MusicProviderClient
from app.services.music_providers.apple import AppleMusicProvider
from app.services.music_providers.soundcloud import SoundcloudProvider
from app.services.music_providers.spotify import SpotifyProvider
from app.services.music_providers.tidal import TidalProvider


def get_music_provider(provider: str, access_token: str) -> MusicProviderClient:
    provider = provider.lower()
    if provider == "apple":
        return AppleMusicProvider(access_token)
    if provider == "soundcloud":
        return SoundcloudProvider(access_token)
    if provider == "spotify":
        return SpotifyProvider(access_token)
    if provider == "tidal":
        return TidalProvider(access_token)
    raise ValueError(f"Unsupported provider: {provider}")
