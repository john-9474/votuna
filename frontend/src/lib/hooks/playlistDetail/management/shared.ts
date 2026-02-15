import type { ManagementDirection, ManagementPlaylistRef, ManagementSelectionMode } from '@/lib/types/votuna'

export type ProviderPlaylist = {
  provider: string
  provider_playlist_id: string
  title: string
  description?: string | null
  image_url?: string | null
}

export type ManagementCounterpartyOption = {
  key: string
  label: string
  sourceTypeLabel: string
  imageUrl: string | null
  ref: ManagementPlaylistRef
}

export const MANAGEMENT_SOURCE_TRACK_LIMIT = 10

export type ManagementAction = 'add_to_this_playlist' | 'copy_to_another_playlist'
export type ManagementSongScope = ManagementSelectionMode

export const directionToAction = (direction: ManagementDirection): ManagementAction =>
  direction === 'import_to_current' ? 'add_to_this_playlist' : 'copy_to_another_playlist'

export const actionToDirection = (action: ManagementAction): ManagementDirection =>
  action === 'add_to_this_playlist' ? 'import_to_current' : 'export_from_current'

export const uniqueTrimmedValues = (values: string[]) => {
  const deduped: string[] = []
  const seen = new Set<string>()
  for (const rawValue of values) {
    const value = rawValue.trim()
    if (!value) continue
    const normalized = value.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    deduped.push(value)
  }
  return deduped
}

export const hasValue = (values: string[], candidate: string) => {
  const normalizedCandidate = candidate.trim().toLowerCase()
  if (!normalizedCandidate) return false
  return values.some((value) => value.trim().toLowerCase() === normalizedCandidate)
}

export const addUniqueValue = (values: string[], candidate: string) => {
  const trimmedCandidate = candidate.trim()
  if (!trimmedCandidate || hasValue(values, trimmedCandidate)) return values
  return [...values, trimmedCandidate]
}

export const removeValue = (values: string[], candidate: string) => {
  const normalizedCandidate = candidate.trim().toLowerCase()
  return values.filter((value) => value.trim().toLowerCase() !== normalizedCandidate)
}

export const toPlaylistRefKey = (ref: ManagementPlaylistRef) =>
  ref.kind === 'provider'
    ? `provider:${ref.provider}:${ref.provider_playlist_id}`
    : `votuna:${ref.votuna_playlist_id}`
