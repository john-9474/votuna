import { useMutation, type QueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiJson, type ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/constants/queryKeys'
import type {
  ManagementExecuteResponse,
  ManagementPlaylistRef,
  ManagementPreviewResponse,
  ManagementShuffleResponse,
  ManagementSourceTracksResponse,
  VotunaPlaylist,
} from '@/lib/types/votuna'
import { useManagementCounterparty } from '@/lib/hooks/playlistDetail/management/useManagementCounterparty'
import { useManagementFacets } from '@/lib/hooks/playlistDetail/management/useManagementFacets'
import {
  actionToDirection,
  addUniqueValue,
  hasValue,
  removeValue,
  type ManagementAction,
  type ManagementSongScope,
} from '@/lib/hooks/playlistDetail/management/shared'
import {
  useManagementTransfer,
  type ManagementReviewStatus,
} from '@/lib/hooks/playlistDetail/management/useManagementTransfer'
import { useManagementSourceTracks } from '@/lib/hooks/playlistDetail/management/useManagementSourceTracks'

type ManagementFacetValue = {
  value: string
  count: number
}

type ManagementFacetSelectionState = {
  selectedValues: string[]
  suggestions: ManagementFacetValue[]
  customInput: string
  setCustomInput: (value: string) => void
  addCustomValue: () => void
  toggleSuggestion: (value: string) => void
  removeValue: (value: string) => void
  isLoading: boolean
  status: string
}

export type PlaylistManagementState = {
  permissions: {
    canManage: boolean
  }
  utilitySections: Array<{
    id: string
    title: string
    description: string
  }>
  steps: {
    canProceedFromAction: boolean
    canProceedFromPlaylists: boolean
    canProceedFromSongScope: boolean
  }
  action: {
    value: ManagementAction
    setValue: (value: ManagementAction) => void
    applyQuickAction: () => void
  }
  playlists: {
    thisPlaylistLabel: string
    sourceLabel: string
    destinationLabel: string
    otherPlaylist: {
      sourceMode: 'my_playlists' | 'search_playlists'
      setSourceMode: (value: 'my_playlists' | 'search_playlists') => void
      options: Array<{
        key: string
        label: string
        sourceTypeLabel: string
        imageUrl: string | null
      }>
      selectedKey: string
      setSelectedKey: (value: string) => void
      hasOptions: boolean
      hasMyOptions: boolean
      search: {
        input: string
        setInput: (value: string) => void
        run: () => void
        isPending: boolean
        status: string
        hasResults: boolean
      }
    }
    destination: {
      mode: 'existing' | 'create'
      setMode: (value: 'existing' | 'create') => void
      isCreatingNew: boolean
      createForm: {
        title: string
        setTitle: (value: string) => void
        description: string
        setDescription: (value: string) => void
        isPublic: boolean
        setIsPublic: (value: boolean) => void
      }
    }
  }
  songScope: {
    value: ManagementSongScope
    setValue: (value: ManagementSongScope) => void
    genre: ManagementFacetSelectionState
    artist: ManagementFacetSelectionState
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
  }
  review: {
    status: ManagementReviewStatus
    isFresh: boolean
    isUpdating: boolean
    data: ManagementPreviewResponse | null
    error: string
    idleMessage: string
    canRun: boolean
    run: () => void
    isRunning: boolean
    runResult: ManagementExecuteResponse | null
    runError: string
  }
  shuffle: {
    run: () => void
    isRunning: boolean
    result: ManagementShuffleResponse | null
    statusMessage: string
  }
}

type UsePlaylistManagementArgs = {
  playlistId: string | undefined
  playlist: VotunaPlaylist | null
  canManage: boolean
  currentUserId: number | undefined
  queryClient: QueryClient
}

const DEFAULT_UTILITY_SECTIONS = [
  {
    id: 'duplicate-cleanup',
    title: 'Duplicate cleanup',
    description: 'Coming soon: remove duplicate songs inside a playlist.',
  },
  {
    id: 'more-utilities',
    title: 'More utilities',
    description: 'Coming soon: additional bulk playlist management actions.',
  },
]

const updateSelectionWithToggle = (values: string[], value: string) =>
  hasValue(values, value) ? removeValue(values, value) : addUniqueValue(values, value)

export function usePlaylistManagement({
  playlistId,
  playlist,
  canManage,
  currentUserId,
  queryClient,
}: UsePlaylistManagementArgs): PlaylistManagementState {
  const [action, setAction] = useState<ManagementAction>('add_to_this_playlist')
  const [destinationMode, setDestinationMode] = useState<'existing' | 'create'>('existing')
  const [destinationCreateTitle, setDestinationCreateTitle] = useState('')
  const [destinationCreateDescription, setDestinationCreateDescription] = useState('')
  const [destinationCreateIsPublic, setDestinationCreateIsPublic] = useState(false)
  const [songScope, setSongScope] = useState<ManagementSongScope>('all')

  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [genreCustomInput, setGenreCustomInput] = useState('')
  const [selectedArtists, setSelectedArtists] = useState<string[]>([])
  const [artistCustomInput, setArtistCustomInput] = useState('')
  const [shuffleResult, setShuffleResult] = useState<ManagementShuffleResponse | null>(null)
  const [shuffleStatusMessage, setShuffleStatusMessage] = useState('')

  const direction = actionToDirection(action)

  const counterpartyState = useManagementCounterparty({
    playlist,
    canManage,
    currentUserId,
  })
  const {
    sourceMode: counterpartySourceMode,
    setSourceMode: setCounterpartySourceMode,
    searchInput: counterpartySearchInput,
    setSearchInput: setCounterpartySearchInput,
    searchStatus: counterpartySearchStatus,
    isSearchPending: isCounterpartySearchPending,
    discoverCounterpartyPlaylists,
    myCounterpartyOptions,
    searchCounterpartyOptions,
    allCounterpartyOptions,
    visibleCounterpartyOptions,
    selectedCounterpartyKey,
    setSelectedCounterpartyKey,
    selectedCounterpartyRef,
  } = counterpartyState

  const isImportAction = action === 'add_to_this_playlist'
  const effectiveCounterpartyOptions = isImportAction
    ? visibleCounterpartyOptions
    : myCounterpartyOptions
  const selectedCounterpartyInMyOptions = useMemo(
    () => myCounterpartyOptions.some((option) => option.key === selectedCounterpartyKey),
    [myCounterpartyOptions, selectedCounterpartyKey],
  )
  const selectedCounterpartyRefForAction = useMemo(() => {
    if (!selectedCounterpartyRef) return null
    if (action === 'add_to_this_playlist') return selectedCounterpartyRef
    return selectedCounterpartyInMyOptions ? selectedCounterpartyRef : null
  }, [action, selectedCounterpartyRef, selectedCounterpartyInMyOptions])

  const isCreatingDestination = action === 'copy_to_another_playlist' && destinationMode === 'create'

  useEffect(() => {
    if (!isCreatingDestination) return
    setSelectedCounterpartyKey('')
  }, [isCreatingDestination, setSelectedCounterpartyKey])

  useEffect(() => {
    if (isImportAction) return
    if (counterpartySourceMode === 'my_playlists') return
    setCounterpartySourceMode('my_playlists')
  }, [isImportAction, counterpartySourceMode, setCounterpartySourceMode])

  useEffect(() => {
    if (isImportAction) return
    if (!selectedCounterpartyKey) return
    if (selectedCounterpartyInMyOptions) return
    setSelectedCounterpartyKey('')
  }, [
    isImportAction,
    selectedCounterpartyKey,
    selectedCounterpartyInMyOptions,
    setSelectedCounterpartyKey,
  ])

  const sourceRefForPicker = useMemo<ManagementPlaylistRef | null>(() => {
    if (!playlist) return null
    if (action === 'add_to_this_playlist') {
      return selectedCounterpartyRefForAction
    }
    return {
      kind: 'votuna',
      votuna_playlist_id: playlist.id,
    }
  }, [playlist, action, selectedCounterpartyRefForAction])

  const sourceTrackState = useManagementSourceTracks({
    playlistId,
    canManage,
    selectionMode: songScope,
    sourceRef: sourceRefForPicker,
  })
  const { resetSourceTracks } = sourceTrackState

  useEffect(() => {
    resetSourceTracks()
  }, [action, selectedCounterpartyKey, destinationMode, resetSourceTracks])

  const facetsState = useManagementFacets({
    playlistId,
    canManage: canManage && (songScope === 'genre' || songScope === 'artist'),
    sourceRef: sourceRefForPicker,
  })

  const transferSelectionValues = useMemo(() => {
    if (songScope === 'all') return []
    if (songScope === 'songs') return sourceTrackState.selectedSongIds
    if (songScope === 'genre') return selectedGenres
    return selectedArtists
  }, [
    songScope,
    sourceTrackState.selectedSongIds,
    selectedGenres,
    selectedArtists,
  ])

  const transferState = useManagementTransfer({
    playlistId,
    queryClient,
    direction,
    exportTargetMode: destinationMode,
    selectedCounterpartyRef: selectedCounterpartyRefForAction,
    destinationCreateTitle,
    destinationCreateDescription,
    destinationCreateIsPublic,
    selectionMode: songScope,
    selectionValues: transferSelectionValues,
  })

  useEffect(() => {
    setShuffleResult(null)
    setShuffleStatusMessage('')
  }, [playlistId])

  const shuffleMutation = useMutation({
    mutationFn: async () => {
      if (!playlistId) {
        throw new Error('Playlist id is required')
      }
      return apiJson<ManagementShuffleResponse>(
        `/api/v1/votuna/playlists/${playlistId}/management/shuffle`,
        {
          method: 'POST',
          authRequired: true,
        },
      )
    },
    onMutate: () => {
      setShuffleResult(null)
      setShuffleStatusMessage('')
    },
    onSuccess: async (data) => {
      setShuffleResult(data)
      if (data.status === 'partial_failure') {
        setShuffleStatusMessage(data.error || 'Shuffle partially completed.')
      } else if (data.moved_items > 0) {
        setShuffleStatusMessage(`Shuffle completed. Moved ${data.moved_items} songs.`)
      } else {
        setShuffleStatusMessage('Shuffle completed. Playlist order did not change.')
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.votunaTracks(playlistId) })
    },
    onError: (error) => {
      const apiError = error as ApiError
      setShuffleResult(null)
      setShuffleStatusMessage(apiError?.detail || apiError?.message || 'Unable to shuffle playlist')
    },
  })

  const runShuffle = useCallback(() => {
    if (!playlistId || !canManage || shuffleMutation.isPending) return
    shuffleMutation.mutate()
  }, [canManage, playlistId, shuffleMutation])

  const selectedCounterpartyOption = useMemo(
    () =>
      selectedCounterpartyRefForAction
        ? allCounterpartyOptions.find((option) => option.key === selectedCounterpartyKey) ?? null
        : null,
    [allCounterpartyOptions, selectedCounterpartyKey, selectedCounterpartyRefForAction],
  )

  const thisPlaylistLabel = playlist?.title || 'This playlist'
  const otherPlaylistLabel = selectedCounterpartyOption?.label || 'Other playlist'
  const destinationCreateLabel = destinationCreateTitle.trim() || 'New playlist'

  const sourceLabel =
    action === 'add_to_this_playlist' ? otherPlaylistLabel : thisPlaylistLabel
  const destinationLabel =
    action === 'add_to_this_playlist'
      ? thisPlaylistLabel
      : isCreatingDestination
        ? destinationCreateLabel
        : otherPlaylistLabel

  const canProceedFromAction = true
  const canProceedFromPlaylists = action === 'add_to_this_playlist'
    ? Boolean(selectedCounterpartyRefForAction)
    : isCreatingDestination
      ? Boolean(destinationCreateTitle.trim())
      : Boolean(selectedCounterpartyRefForAction)

  const canProceedFromSongScope =
    songScope === 'all'
      ? true
      : songScope === 'songs'
        ? sourceTrackState.selectedSongIds.length > 0
        : songScope === 'genre'
          ? selectedGenres.length > 0
          : selectedArtists.length > 0

  const reviewIdleMessage = useMemo(() => {
    if (!canProceedFromPlaylists) {
      if (action === 'add_to_this_playlist') {
        if (counterpartySourceMode === 'search_playlists') {
          return 'Search or paste a playlist link, then choose a source playlist.'
        }
        return 'Choose the playlist you want to copy songs from.'
      }
      if (isCreatingDestination) {
        return 'Enter a name for the new destination playlist.'
      }
      return 'Choose the playlist you want to copy songs to.'
    }

    if (!canProceedFromSongScope) {
      if (songScope === 'songs') return 'Pick at least one song.'
      if (songScope === 'genre') return 'Choose at least one genre or add a custom genre.'
      if (songScope === 'artist') return 'Choose at least one artist or add a custom artist.'
    }

    if (transferState.reviewStatus === 'loading') {
      return 'Updating review...'
    }

    if (transferState.canReview && transferState.reviewStatus === 'idle') {
      return 'Set your choices to review what will be copied.'
    }

    return ''
  }, [
    canProceedFromPlaylists,
    action,
    counterpartySourceMode,
    isCreatingDestination,
    canProceedFromSongScope,
    songScope,
    transferState.reviewStatus,
    transferState.canReview,
  ])

  const applyQuickAction = () => {
    setAction('add_to_this_playlist')
    setDestinationMode('existing')
    setCounterpartySourceMode('my_playlists')
    setSongScope('all')
    setSelectedGenres([])
    setSelectedArtists([])
    setGenreCustomInput('')
    setArtistCustomInput('')
    resetSourceTracks()
  }

  const addGenreCustomValue = useCallback(() => {
    const trimmedValue = genreCustomInput.trim()
    if (!trimmedValue) return
    setSelectedGenres((prev) => addUniqueValue(prev, trimmedValue))
    setGenreCustomInput('')
  }, [genreCustomInput])

  const addArtistCustomValue = useCallback(() => {
    const trimmedValue = artistCustomInput.trim()
    if (!trimmedValue) return
    setSelectedArtists((prev) => addUniqueValue(prev, trimmedValue))
    setArtistCustomInput('')
  }, [artistCustomInput])

  return {
    permissions: {
      canManage,
    },
    utilitySections: DEFAULT_UTILITY_SECTIONS,
    steps: {
      canProceedFromAction,
      canProceedFromPlaylists,
      canProceedFromSongScope,
    },
    action: {
      value: action,
      setValue: (value) => {
        setAction(value)
        if (value === 'add_to_this_playlist') {
          setDestinationMode('existing')
        } else {
          setCounterpartySourceMode('my_playlists')
        }
      },
      applyQuickAction,
    },
    playlists: {
      thisPlaylistLabel,
      sourceLabel,
      destinationLabel,
      otherPlaylist: {
        sourceMode: counterpartySourceMode,
        setSourceMode: setCounterpartySourceMode,
        options: effectiveCounterpartyOptions.map((option) => ({
          key: option.key,
          label: option.label,
          sourceTypeLabel: option.sourceTypeLabel,
          imageUrl: option.imageUrl ?? null,
        })),
        selectedKey: selectedCounterpartyKey,
        setSelectedKey: setSelectedCounterpartyKey,
        hasOptions: effectiveCounterpartyOptions.length > 0,
        hasMyOptions: myCounterpartyOptions.length > 0,
        search: {
          input: counterpartySearchInput,
          setInput: setCounterpartySearchInput,
          run: discoverCounterpartyPlaylists,
          isPending: isCounterpartySearchPending,
          status: counterpartySearchStatus,
          hasResults: searchCounterpartyOptions.length > 0,
        },
      },
      destination: {
        mode: destinationMode,
        setMode: setDestinationMode,
        isCreatingNew: isCreatingDestination,
        createForm: {
          title: destinationCreateTitle,
          setTitle: setDestinationCreateTitle,
          description: destinationCreateDescription,
          setDescription: setDestinationCreateDescription,
          isPublic: destinationCreateIsPublic,
          setIsPublic: setDestinationCreateIsPublic,
        },
      },
    },
    songScope: {
      value: songScope,
      setValue: setSongScope,
      genre: {
        selectedValues: selectedGenres,
        suggestions: facetsState.genreSuggestions,
        customInput: genreCustomInput,
        setCustomInput: setGenreCustomInput,
        addCustomValue: addGenreCustomValue,
        toggleSuggestion: (value) =>
          setSelectedGenres((prev) => updateSelectionWithToggle(prev, value)),
        removeValue: (value) => setSelectedGenres((prev) => removeValue(prev, value)),
        isLoading: facetsState.isFacetsLoading,
        status: facetsState.facetsStatus,
      },
      artist: {
        selectedValues: selectedArtists,
        suggestions: facetsState.artistSuggestions,
        customInput: artistCustomInput,
        setCustomInput: setArtistCustomInput,
        addCustomValue: addArtistCustomValue,
        toggleSuggestion: (value) =>
          setSelectedArtists((prev) => updateSelectionWithToggle(prev, value)),
        removeValue: (value) => setSelectedArtists((prev) => removeValue(prev, value)),
        isLoading: facetsState.isFacetsLoading,
        status: facetsState.facetsStatus,
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
    },
    review: {
      status: transferState.reviewStatus,
      isFresh: transferState.isReviewFresh,
      isUpdating: transferState.isReviewLoading,
      data: transferState.preview,
      error: transferState.previewError,
      idleMessage: reviewIdleMessage,
      canRun: transferState.canExecute,
      run: transferState.onExecute,
      isRunning: transferState.isExecutePending,
      runResult: transferState.executeResult,
      runError: transferState.executeError,
    },
    shuffle: {
      run: runShuffle,
      isRunning: shuffleMutation.isPending,
      result: shuffleResult,
      statusMessage: shuffleStatusMessage,
    },
  }
}
