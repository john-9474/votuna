import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { apiJson, type ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/constants/queryKeys'
import type { ManagementFacetsResponse, ManagementPlaylistRef } from '@/lib/types/votuna'

import { toPlaylistRefKey } from './shared'

type UseManagementFacetsArgs = {
  playlistId: string | undefined
  canManage: boolean
  sourceRef: ManagementPlaylistRef | null
}

export function useManagementFacets({ playlistId, canManage, sourceRef }: UseManagementFacetsArgs) {
  const sourceRefKey = sourceRef ? toPlaylistRefKey(sourceRef) : ''

  const facetsQuery = useQuery({
    queryKey: queryKeys.votunaManagementFacets(playlistId, sourceRefKey),
    queryFn: () =>
      apiJson<ManagementFacetsResponse>(
        `/api/v1/votuna/playlists/${playlistId}/management/facets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          authRequired: true,
          body: JSON.stringify({ source: sourceRef }),
        },
      ),
    enabled: Boolean(playlistId && canManage && sourceRef),
    staleTime: 10_000,
  })

  const facetsStatus = useMemo(() => {
    if (!facetsQuery.error) return ''
    const apiError = facetsQuery.error as ApiError
    return apiError?.detail || apiError?.message || 'Unable to load genre/artist suggestions'
  }, [facetsQuery.error])

  return {
    genreSuggestions: facetsQuery.data?.genres ?? [],
    artistSuggestions: facetsQuery.data?.artists ?? [],
    totalTracksConsidered: facetsQuery.data?.total_tracks_considered ?? 0,
    isFacetsLoading: facetsQuery.isLoading,
    facetsStatus,
  }
}

