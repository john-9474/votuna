import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiJson, type ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/constants/queryKeys'
import type {
  ManagementPlaylistRef,
  ManagementSelectionMode,
  ManagementSourceTracksResponse,
} from '@/lib/types/votuna'

import { MANAGEMENT_SOURCE_TRACK_LIMIT, toPlaylistRefKey } from './shared'

type UseManagementSourceTracksArgs = {
  playlistId: string | undefined
  canManage: boolean
  selectionMode: ManagementSelectionMode
  sourceRef: ManagementPlaylistRef | null
}

export function useManagementSourceTracks({
  playlistId,
  canManage,
  selectionMode,
  sourceRef,
}: UseManagementSourceTracksArgs) {
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([])
  const [sourceTrackSearch, setSourceTrackSearch] = useState('')
  const [sourceTrackOffset, setSourceTrackOffset] = useState(0)

  const sourceRefKey = sourceRef ? toPlaylistRefKey(sourceRef) : ''

  const sourceTracksQuery = useQuery({
    queryKey: queryKeys.votunaManagementSourceTracks(
      playlistId,
      sourceRefKey,
      sourceTrackSearch,
      MANAGEMENT_SOURCE_TRACK_LIMIT,
      sourceTrackOffset,
    ),
    queryFn: () =>
      apiJson<ManagementSourceTracksResponse>(
        `/api/v1/votuna/playlists/${playlistId}/management/source-tracks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          authRequired: true,
          body: JSON.stringify({
            source: sourceRef,
            search: sourceTrackSearch.trim() || null,
            limit: MANAGEMENT_SOURCE_TRACK_LIMIT,
            offset: sourceTrackOffset,
          }),
        },
      ),
    enabled: Boolean(playlistId && canManage && selectionMode === 'songs' && sourceRef),
    staleTime: 10_000,
  })

  useEffect(() => {
    setSourceTrackOffset(0)
  }, [sourceTrackSearch])

  const sourceTracksStatus = useMemo(() => {
    if (!sourceTracksQuery.error) return ''
    const apiError = sourceTracksQuery.error as ApiError
    return apiError?.detail || apiError?.message || 'Unable to load source tracks'
  }, [sourceTracksQuery.error])

  const toggleSelectedSong = useCallback((trackId: string) => {
    setSelectedSongIds((prev) =>
      prev.includes(trackId) ? prev.filter((value) => value !== trackId) : [...prev, trackId],
    )
  }, [])

  const resetSourceTracks = useCallback(() => {
    setSelectedSongIds([])
    setSourceTrackSearch('')
    setSourceTrackOffset(0)
  }, [])

  return {
    sourceTrackLimit: MANAGEMENT_SOURCE_TRACK_LIMIT,
    sourceTrackOffset,
    sourceTrackTotalCount: sourceTracksQuery.data?.total_count ?? 0,
    setSourceTrackOffset,
    sourceTrackSearch,
    setSourceTrackSearch,
    sourceTracks: sourceTracksQuery.data?.tracks ?? [],
    isSourceTracksLoading: sourceTracksQuery.isLoading,
    sourceTracksStatus,
    selectedSongIds,
    toggleSelectedSong,
    resetSourceTracks,
  }
}
