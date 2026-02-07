import type { QueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import type {
  ManagementDirection,
  ManagementExecuteResponse,
  ManagementPlaylistRef,
  ManagementPreviewResponse,
  ManagementSelectionMode,
  ManagementSourceTracksResponse,
  VotunaPlaylist,
} from '@/lib/types/votuna'
import { useManagementCounterparty } from '@/lib/hooks/playlistDetail/management/useManagementCounterparty'
import { useManagementSourceTracks } from '@/lib/hooks/playlistDetail/management/useManagementSourceTracks'
import { useManagementTransfer } from '@/lib/hooks/playlistDetail/management/useManagementTransfer'

export type PlaylistManagementState = {
  permissions: {
    canManage: boolean
  }
  builder: {
    direction: ManagementDirection
    setDirection: (value: ManagementDirection) => void
    exportTargetMode: 'existing' | 'create'
    setExportTargetMode: (value: 'existing' | 'create') => void
    isCreatingDestination: boolean
    counterpartyOptions: Array<{ key: string; label: string; detail: string }>
    selectedCounterpartyKey: string
    setSelectedCounterpartyKey: (value: string) => void
    destinationCreate: {
      title: string
      setTitle: (value: string) => void
      description: string
      setDescription: (value: string) => void
      isPublic: boolean
      setIsPublic: (value: boolean) => void
    }
    selection: {
      mode: ManagementSelectionMode
      setMode: (value: ManagementSelectionMode) => void
      valuesInput: string
      setValuesInput: (value: string) => void
    }
  }
  sourcePicker: {
    search: string
    setSearch: (value: string) => void
    pagination: {
      limit: number
      offset: number
      totalCount: number
      setOffset: (value: number) => void
    }
    tracks: ManagementSourceTracksResponse['tracks']
    selectedSongIds: string[]
    toggleSelectedSong: (trackId: string) => void
    isLoading: boolean
    status: string
  }
  preview: {
    canRun: boolean
    isPending: boolean
    data: ManagementPreviewResponse | null
    error: string
    run: () => void
  }
  execute: {
    canRun: boolean
    isPending: boolean
    data: ManagementExecuteResponse | null
    error: string
    run: () => void
  }
  actions: {
    applyMergePreset: () => void
  }
}

type UsePlaylistManagementArgs = {
  playlistId: string | undefined
  playlist: VotunaPlaylist | null
  canManage: boolean
  currentUserId: number | undefined
  queryClient: QueryClient
}

export function usePlaylistManagement({
  playlistId,
  playlist,
  canManage,
  currentUserId,
  queryClient,
}: UsePlaylistManagementArgs): PlaylistManagementState {
  const [direction, setDirection] = useState<ManagementDirection>('import_to_current')
  const [exportTargetMode, setExportTargetMode] = useState<'existing' | 'create'>('existing')
  const [destinationCreateTitle, setDestinationCreateTitle] = useState('')
  const [destinationCreateDescription, setDestinationCreateDescription] = useState('')
  const [destinationCreateIsPublic, setDestinationCreateIsPublic] = useState(false)
  const [selectionMode, setSelectionMode] = useState<ManagementSelectionMode>('all')
  const [selectionValuesInput, setSelectionValuesInput] = useState('')

  const counterpartyState = useManagementCounterparty({
    playlist,
    canManage,
    currentUserId,
  })
  const {
    counterpartyOptions,
    selectedCounterpartyKey,
    setSelectedCounterpartyKey,
    selectedCounterpartyRef,
  } = counterpartyState

  useEffect(() => {
    if (direction !== 'export_from_current' || exportTargetMode !== 'create') return
    setSelectedCounterpartyKey('')
  }, [direction, exportTargetMode, setSelectedCounterpartyKey])

  const sourceRefForPicker = useMemo<ManagementPlaylistRef | null>(() => {
    if (!playlist) return null
    if (direction === 'import_to_current') {
      return selectedCounterpartyRef
    }
    return {
      kind: 'votuna',
      votuna_playlist_id: playlist.id,
    }
  }, [playlist, direction, selectedCounterpartyRef])

  const sourceTrackState = useManagementSourceTracks({
    playlistId,
    canManage,
    selectionMode,
    sourceRef: sourceRefForPicker,
  })
  const { resetSourceTracks } = sourceTrackState

  useEffect(() => {
    resetSourceTracks()
  }, [direction, selectedCounterpartyKey, exportTargetMode, resetSourceTracks])

  const transferState = useManagementTransfer({
    playlistId,
    queryClient,
    direction,
    exportTargetMode,
    selectedCounterpartyRef,
    destinationCreateTitle,
    destinationCreateDescription,
    destinationCreateIsPublic,
    selectionMode,
    selectionValuesInput,
    selectedSongIds: sourceTrackState.selectedSongIds,
  })

  const applyMergePreset = () => {
    setDirection('import_to_current')
    setExportTargetMode('existing')
    setSelectionMode('all')
    setSelectionValuesInput('')
    resetSourceTracks()
  }

  const isCreatingDestination =
    direction === 'export_from_current' && exportTargetMode === 'create'

  return {
    permissions: {
      canManage,
    },
    builder: {
      direction,
      setDirection,
      exportTargetMode,
      setExportTargetMode,
      isCreatingDestination,
      counterpartyOptions: counterpartyOptions.map(({ key, label, detail }) => ({
        key,
        label,
        detail,
      })),
      selectedCounterpartyKey,
      setSelectedCounterpartyKey,
      destinationCreate: {
        title: destinationCreateTitle,
        setTitle: setDestinationCreateTitle,
        description: destinationCreateDescription,
        setDescription: setDestinationCreateDescription,
        isPublic: destinationCreateIsPublic,
        setIsPublic: setDestinationCreateIsPublic,
      },
      selection: {
        mode: selectionMode,
        setMode: setSelectionMode,
        valuesInput: selectionValuesInput,
        setValuesInput: setSelectionValuesInput,
      },
    },
    sourcePicker: {
      search: sourceTrackState.sourceTrackSearch,
      setSearch: sourceTrackState.setSourceTrackSearch,
      pagination: {
        limit: sourceTrackState.sourceTrackLimit,
        offset: sourceTrackState.sourceTrackOffset,
        totalCount: sourceTrackState.sourceTrackTotalCount,
        setOffset: sourceTrackState.setSourceTrackOffset,
      },
      tracks: sourceTrackState.sourceTracks,
      selectedSongIds: sourceTrackState.selectedSongIds,
      toggleSelectedSong: sourceTrackState.toggleSelectedSong,
      isLoading: sourceTrackState.isSourceTracksLoading,
      status: sourceTrackState.sourceTracksStatus,
    },
    preview: {
      canRun: transferState.canPreview,
      isPending: transferState.isPreviewPending,
      data: transferState.preview,
      error: transferState.previewError,
      run: transferState.onPreview,
    },
    execute: {
      canRun: transferState.canExecute,
      isPending: transferState.isExecutePending,
      data: transferState.executeResult,
      error: transferState.executeError,
      run: transferState.onExecute,
    },
    actions: {
      applyMergePreset,
    },
  }
}
