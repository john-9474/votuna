import type { ManagementPlaylistRef } from '@/lib/types/votuna'

export type ProviderPlaylist = {
  provider: string
  provider_playlist_id: string
  title: string
  description?: string | null
}

export type ManagementCounterpartyOption = {
  key: string
  label: string
  detail: string
  ref: ManagementPlaylistRef
}

export const MANAGEMENT_SOURCE_TRACK_LIMIT = 50

export const uniqueTrimmedValues = (value: string) => {
  const seen = new Set<string>()
  const normalizedSeen = new Set<string>()

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const normalized = item.toLowerCase()
      if (normalizedSeen.has(normalized)) return false
      normalizedSeen.add(normalized)
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
}

export const toPlaylistRefKey = (ref: ManagementPlaylistRef) =>
  ref.kind === 'provider'
    ? `provider:${ref.provider}:${ref.provider_playlist_id}`
    : `votuna:${ref.votuna_playlist_id}`
