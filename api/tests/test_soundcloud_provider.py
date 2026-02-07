from app.services.music_providers.soundcloud import SoundcloudProvider


def test_extract_handle_query_variants():
    provider = SoundcloudProvider("token")
    assert provider._extract_handle_query("@dj-sets") == "dj-sets"
    assert provider._extract_handle_query("https://soundcloud.com/dj-sets") == "dj-sets"
    assert provider._extract_handle_query("soundcloud.com/dj-sets") == "dj-sets"
    assert provider._extract_handle_query("display name with spaces") is None


def test_to_provider_user_maps_handle_and_display_name():
    provider = SoundcloudProvider("token")
    mapped = provider._to_provider_user(
        {
            "id": 123,
            "username": "Display Name",
            "permalink": "dj-handle",
            "permalink_url": "https://soundcloud.com/dj-handle",
            "avatar_url": "https://img.example/avatar.jpg",
        }
    )
    assert mapped is not None
    assert mapped.provider_user_id == "123"
    assert mapped.username == "dj-handle"
    assert mapped.display_name == "Display Name"
    assert mapped.profile_url == "https://soundcloud.com/dj-handle"
