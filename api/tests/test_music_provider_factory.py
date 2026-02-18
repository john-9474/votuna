import pytest

from app.services.music_providers.factory import get_music_provider
from app.services.music_providers.apple import AppleMusicProvider
from app.services.music_providers.soundcloud import SoundcloudProvider
from app.services.music_providers.spotify import SpotifyProvider
from app.services.music_providers.tidal import TidalProvider


def test_get_music_provider_returns_soundcloud_provider():
    provider = get_music_provider("soundcloud", "token")
    assert isinstance(provider, SoundcloudProvider)


def test_get_music_provider_returns_spotify_provider():
    provider = get_music_provider("spotify", "token")
    assert isinstance(provider, SpotifyProvider)


def test_get_music_provider_returns_apple_provider():
    provider = get_music_provider("apple", "token")
    assert isinstance(provider, AppleMusicProvider)


def test_get_music_provider_returns_tidal_provider():
    provider = get_music_provider("tidal", "token")
    assert isinstance(provider, TidalProvider)


def test_get_music_provider_rejects_unknown_provider():
    with pytest.raises(ValueError):
        get_music_provider("unknown", "token")
