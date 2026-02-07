import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { apiJson } from '@/lib/api'
import { queryKeys } from '@/lib/constants/queryKeys'
import type { ManagementPlaylistRef, VotunaPlaylist } from '@/lib/types/votuna'

import type { ManagementCounterpartyOption, ProviderPlaylist } from './shared'

type UseManagementCounterpartyArgs = {
  playlist: VotunaPlaylist | null
  canManage: boolean
  currentUserId: number | undefined
}

export function useManagementCounterparty({
  playlist,
  canManage,
  currentUserId,
}: UseManagementCounterpartyArgs) {
  const [selectedCounterpartyKey, setSelectedCounterpartyKey] = useState('')

  const providerPlaylistsQuery = useQuery({
    queryKey: queryKeys.providerPlaylistsByProvider(playlist?.provider || ''),
    queryFn: () =>
      apiJson<ProviderPlaylist[]>(`/api/v1/playlists/providers/${playlist?.provider}`, {
        authRequired: true,
      }),
    enabled: Boolean(playlist?.provider && canManage),
    staleTime: 30_000,
  })

  const votunaPlaylistsQuery = useQuery({
    queryKey: queryKeys.votunaPlaylists,
    queryFn: () => apiJson<VotunaPlaylist[]>('/api/v1/votuna/playlists', { authRequired: true }),
    enabled: canManage,
    staleTime: 30_000,
  })

  const counterpartyOptions = useMemo<ManagementCounterpartyOption[]>(() => {
    if (!playlist) return []

    const options: ManagementCounterpartyOption[] = []

    for (const providerPlaylist of providerPlaylistsQuery.data ?? []) {
      if (
        providerPlaylist.provider !== playlist.provider ||
        providerPlaylist.provider_playlist_id === playlist.provider_playlist_id
      ) {
        continue
      }
      options.push({
        key: `provider:${providerPlaylist.provider}:${providerPlaylist.provider_playlist_id}`,
        label: providerPlaylist.title,
        detail: 'Provider playlist',
        ref: {
          kind: 'provider',
          provider: providerPlaylist.provider,
          provider_playlist_id: providerPlaylist.provider_playlist_id,
        },
      })
    }

    for (const votunaPlaylist of votunaPlaylistsQuery.data ?? []) {
      if (
        votunaPlaylist.id === playlist.id ||
        votunaPlaylist.owner_user_id !== currentUserId ||
        votunaPlaylist.provider !== playlist.provider
      ) {
        continue
      }
      options.push({
        key: `votuna:${votunaPlaylist.id}`,
        label: votunaPlaylist.title,
        detail: 'Votuna playlist',
        ref: {
          kind: 'votuna',
          votuna_playlist_id: votunaPlaylist.id,
        },
      })
    }

    return options
  }, [
    playlist,
    providerPlaylistsQuery.data,
    votunaPlaylistsQuery.data,
    currentUserId,
  ])

  useEffect(() => {
    if (!selectedCounterpartyKey) return
    const exists = counterpartyOptions.some((option) => option.key === selectedCounterpartyKey)
    if (!exists) {
      setSelectedCounterpartyKey('')
    }
  }, [selectedCounterpartyKey, counterpartyOptions])

  const selectedCounterpartyRef = useMemo<ManagementPlaylistRef | null>(
    () => counterpartyOptions.find((option) => option.key === selectedCounterpartyKey)?.ref ?? null,
    [counterpartyOptions, selectedCounterpartyKey],
  )

  return {
    counterpartyOptions,
    selectedCounterpartyKey,
    setSelectedCounterpartyKey,
    selectedCounterpartyRef,
  }
}
