type ProviderPlaylistLinkInput = {
  provider: string | null | undefined
  providerPlaylistId?: string | null
  providerPlaylistUrl?: string | null
  playlistTitle?: string | null
  profilePermalinkUrl?: string | null
}

const normalizePermalinkBase = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/+$/, '')
  }
  return `https://soundcloud.com/${trimmed.replace(/^\/+|\/+$/g, '')}`
}

const slugifyPlaylistTitle = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export const getProviderPlaylistUrl = ({
  provider,
  providerPlaylistId,
  providerPlaylistUrl,
  playlistTitle,
  profilePermalinkUrl,
}: ProviderPlaylistLinkInput): string | null => {
  const normalizedProvider = (provider ?? '').trim().toLowerCase()
  if (!normalizedProvider) return null
  const normalizedPlaylistUrl = (providerPlaylistUrl ?? '').trim()
  if (normalizedPlaylistUrl.startsWith('http://') || normalizedPlaylistUrl.startsWith('https://')) {
    return normalizedPlaylistUrl
  }

  if (normalizedProvider === 'soundcloud') {
    const profileBase = profilePermalinkUrl ? normalizePermalinkBase(profilePermalinkUrl) : null
    const playlistSlug = playlistTitle ? slugifyPlaylistTitle(playlistTitle) : ''
    if (profileBase && playlistSlug) {
      return `${profileBase}/sets/${encodeURIComponent(playlistSlug)}`
    }
    return null
  }

  const normalizedPlaylistId = (providerPlaylistId ?? '').trim()
  if (!normalizedPlaylistId) return null

  if (normalizedProvider === 'spotify') {
    return `https://open.spotify.com/playlist/${encodeURIComponent(normalizedPlaylistId)}`
  }

  if (normalizedProvider === 'tidal') {
    return `https://listen.tidal.com/playlist/${encodeURIComponent(normalizedPlaylistId)}`
  }

  if (normalizedProvider === 'apple') {
    return `https://music.apple.com/library/playlist/${encodeURIComponent(normalizedPlaylistId)}`
  }

  return null
}
