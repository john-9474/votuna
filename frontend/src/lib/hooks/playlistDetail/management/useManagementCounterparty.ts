import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiJson } from '@/lib/api'
import { queryKeys } from '@/lib/constants/queryKeys'
import type { ManagementPlaylistRef, VotunaPlaylist } from '@/lib/types/votuna'

import type { ManagementCounterpartyOption, ProviderPlaylist } from './shared'

export type CounterpartySourceMode = 'my_playlists' | 'search_playlists'

type UseManagementCounterpartyArgs = {
  playlist: VotunaPlaylist | null
  canManage: boolean
  currentUserId: number | undefined
}

const SEARCH_LIMIT = 12

const toProviderPlaylistIdentity = (provider: string, providerPlaylistId: string) =>
  `${provider}:${providerPlaylistId}`

const normalizePlaylistUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^soundcloud\.com\//i.test(trimmed)) return `https://${trimmed}`
  if (/^open\.spotify\.com\/playlist\//i.test(trimmed)) return `https://${trimmed}`
  if (/^music\.apple\.com\//i.test(trimmed)) return `https://${trimmed}`
  if (/^(listen\.)?tidal\.com\/.*playlist\//i.test(trimmed)) return `https://${trimmed}`
  return ''
}

export function useManagementCounterparty({
  playlist,
  canManage,
  currentUserId,
}: UseManagementCounterpartyArgs) {
  const [sourceMode, setSourceMode] = useState<CounterpartySourceMode>('my_playlists')
  const [selectedCounterpartyKey, setSelectedCounterpartyKey] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchStatus, setSearchStatus] = useState('')
  const [isSearchPending, setIsSearchPending] = useState(false)
  const [searchCounterpartyOptions, setSearchCounterpartyOptions] = useState<
    ManagementCounterpartyOption[]
  >([])

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

  const toProviderCounterpartyOption = useCallback((providerPlaylist: ProviderPlaylist) => {
    if (!playlist) return null
    if (
      providerPlaylist.provider !== playlist.provider ||
      providerPlaylist.provider_playlist_id === playlist.provider_playlist_id
    ) {
      return null
    }
    return {
      key: `provider:${providerPlaylist.provider}:${providerPlaylist.provider_playlist_id}`,
      label: providerPlaylist.title,
      sourceTypeLabel: 'Music provider playlist',
      imageUrl: providerPlaylist.image_url ?? null,
      ref: {
        kind: 'provider' as const,
        provider: providerPlaylist.provider,
        provider_playlist_id: providerPlaylist.provider_playlist_id,
      },
    }
  }, [playlist])

  const myCounterpartyOptions = useMemo<ManagementCounterpartyOption[]>(() => {
    if (!playlist) return []

    const deduped = new Map<string, { option: ManagementCounterpartyOption; priority: number }>()
    const upsertOption = (
      identity: string,
      option: ManagementCounterpartyOption,
      priority: number,
    ) => {
      const existing = deduped.get(identity)
      if (!existing || priority >= existing.priority) {
        deduped.set(identity, { option, priority })
      }
    }

    for (const providerPlaylist of providerPlaylistsQuery.data ?? []) {
      const option = toProviderCounterpartyOption(providerPlaylist)
      if (option) {
        upsertOption(
          toProviderPlaylistIdentity(providerPlaylist.provider, providerPlaylist.provider_playlist_id),
          option,
          1,
        )
      }
    }

    for (const votunaPlaylist of votunaPlaylistsQuery.data ?? []) {
      if (
        votunaPlaylist.id === playlist.id ||
        votunaPlaylist.owner_user_id !== currentUserId ||
        votunaPlaylist.provider !== playlist.provider
      ) {
        continue
      }
      const option = {
        key: `votuna:${votunaPlaylist.id}`,
        label: votunaPlaylist.title,
        sourceTypeLabel: 'Votuna playlist',
        imageUrl: votunaPlaylist.image_url ?? null,
        ref: {
          kind: 'votuna',
          votuna_playlist_id: votunaPlaylist.id,
        },
      }
      upsertOption(
        toProviderPlaylistIdentity(votunaPlaylist.provider, votunaPlaylist.provider_playlist_id),
        option,
        2,
      )
    }

    return Array.from(deduped.values())
      .map(({ option }) => option)
      .sort((left, right) => left.label.localeCompare(right.label))
  }, [
    playlist,
    providerPlaylistsQuery.data,
    votunaPlaylistsQuery.data,
    currentUserId,
    toProviderCounterpartyOption,
  ])

  const allCounterpartyOptions = useMemo<ManagementCounterpartyOption[]>(() => {
    const deduped = new Map<string, ManagementCounterpartyOption>()
    for (const option of myCounterpartyOptions) {
      deduped.set(option.key, option)
    }
    for (const option of searchCounterpartyOptions) {
      if (!deduped.has(option.key)) {
        deduped.set(option.key, option)
      }
    }
    return Array.from(deduped.values()).sort((left, right) => left.label.localeCompare(right.label))
  }, [myCounterpartyOptions, searchCounterpartyOptions])

  const visibleCounterpartyOptions = useMemo(
    () => (sourceMode === 'search_playlists' ? searchCounterpartyOptions : myCounterpartyOptions),
    [sourceMode, searchCounterpartyOptions, myCounterpartyOptions],
  )

  useEffect(() => {
    if (!selectedCounterpartyKey) return
    const exists = allCounterpartyOptions.some((option) => option.key === selectedCounterpartyKey)
    if (!exists) {
      setSelectedCounterpartyKey('')
    }
  }, [selectedCounterpartyKey, allCounterpartyOptions])

  const selectedCounterpartyRef = useMemo<ManagementPlaylistRef | null>(
    () => allCounterpartyOptions.find((option) => option.key === selectedCounterpartyKey)?.ref ?? null,
    [allCounterpartyOptions, selectedCounterpartyKey],
  )

  const discoverCounterpartyPlaylists = async () => {
    if (!playlist?.provider || !canManage) return
    const query = searchInput.trim()
    if (!query) return
    setSearchStatus('')
    setIsSearchPending(true)

    try {
      const normalizedUrl = normalizePlaylistUrl(query)
      if (normalizedUrl) {
        const resolved = await apiJson<ProviderPlaylist>(
          `/api/v1/playlists/providers/${playlist.provider}/resolve?url=${encodeURIComponent(
            normalizedUrl,
          )}`,
          { authRequired: true },
        )
        const option = toProviderCounterpartyOption(resolved)
        if (!option) {
          setSearchCounterpartyOptions([])
          setSearchStatus('This playlist cannot be used as the source for this transfer.')
          return
        }
        setSearchCounterpartyOptions([option])
        setSelectedCounterpartyKey(option.key)
        setSearchStatus('Playlist loaded from link.')
        return
      }

      const results = await apiJson<ProviderPlaylist[]>(
        `/api/v1/playlists/providers/${playlist.provider}/search?q=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}`,
        { authRequired: true },
      )
      const deduped = new Map<string, ManagementCounterpartyOption>()
      for (const providerPlaylist of results) {
        const option = toProviderCounterpartyOption(providerPlaylist)
        if (!option || deduped.has(option.key)) continue
        deduped.set(option.key, option)
      }
      const options = Array.from(deduped.values()).sort((left, right) =>
        left.label.localeCompare(right.label),
      )
      setSearchCounterpartyOptions(options)
      if (options.length === 0) {
        setSearchStatus('No playlists found for that search.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to search playlists'
      setSearchStatus(message)
      setSearchCounterpartyOptions([])
    } finally {
      setIsSearchPending(false)
    }
  }

  return {
    sourceMode,
    setSourceMode,
    searchInput,
    setSearchInput,
    searchStatus,
    isSearchPending,
    discoverCounterpartyPlaylists,
    myCounterpartyOptions,
    searchCounterpartyOptions,
    allCounterpartyOptions,
    visibleCounterpartyOptions,
    selectedCounterpartyKey,
    setSelectedCounterpartyKey,
    selectedCounterpartyRef,
  }
}
