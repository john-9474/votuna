import { useMutation, type QueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { apiFetch, apiJson, type ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/constants/queryKeys'
import type { ProviderTrack, Suggestion } from '@/lib/types/votuna'

type UsePlaylistInteractionsArgs = {
  playlistId: string | undefined
  queryClient: QueryClient
  isCollaborative: boolean
  provider: string | undefined
}

type SuggestPayload = {
  provider_track_id?: string
  track_title?: string | null
  track_artist?: string | null
  track_artwork_url?: string | null
  track_url?: string | null
  allow_resuggest?: boolean
}

type RecommendationFetchOptions = {
  reset: boolean
  nonce: string
  pageSize?: number
}

const REJECTED_TRACK_ERROR_CODE = 'TRACK_PREVIOUSLY_REJECTED'
const RECOMMENDATIONS_BATCH_SIZE = 12
const VISIBLE_RECOMMENDATIONS_COUNT = 5
const RECOMMENDATIONS_QUEUE_PREFETCH_THRESHOLD = 3
const RECOMMENDATIONS_DISABLED_PROVIDERS = new Set(['spotify', 'apple'])

function createRefreshNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isRejectedTrackConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const apiError = error as ApiError
  if (apiError.status !== 409) return false
  const detail = apiError.rawDetail as { code?: string } | undefined
  if (detail?.code === REJECTED_TRACK_ERROR_CODE) return true
  return error.message.toLowerCase().includes('previously rejected')
}

export function usePlaylistInteractions({
  playlistId,
  queryClient,
  isCollaborative,
  provider,
}: UsePlaylistInteractionsArgs) {
  const normalizedProvider = provider?.trim().toLowerCase() ?? ''
  const isRecommendationsSupported = !RECOMMENDATIONS_DISABLED_PROVIDERS.has(normalizedProvider)
  const [suggestStatus, setSuggestStatus] = useState('')
  const [suggestionsActionStatus, setSuggestionsActionStatus] = useState('')
  const [trackActionStatus, setTrackActionStatus] = useState('')
  const [searchQuery, setSearchQueryState] = useState('')
  const [searchResults, setSearchResults] = useState<ProviderTrack[]>([])
  const [suggestedSearchTrackIds, setSuggestedSearchTrackIds] = useState<string[]>([])
  const [searchStatus, setSearchStatus] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchHydrating, setIsSearchHydrating] = useState(false)
  const [linkSuggestionUrl, setLinkSuggestionUrl] = useState('')
  const [removingTrackId, setRemovingTrackId] = useState<string | null>(null)
  const [recommendedTracks, setRecommendedTracks] = useState<ProviderTrack[]>([])
  const [recommendationQueue, setRecommendationQueue] = useState<ProviderTrack[]>([])
  const [recommendationsStatus, setRecommendationsStatus] = useState('')
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false)
  const [isRecommendationActionPending, setIsRecommendationActionPending] = useState(false)
  const [recommendationsOffset, setRecommendationsOffset] = useState(0)
  const [hasMoreRecommendations, setHasMoreRecommendations] = useState(false)
  const [recommendationsRefreshNonce, setRecommendationsRefreshNonce] = useState(createRefreshNonce())
  const latestSearchRequestIdRef = useRef(0)

  useEffect(() => {
    if (isCollaborative) return
    setSuggestedSearchTrackIds([])
  }, [isCollaborative])

  const invalidatePlaylistQueries = async (includeMembers: boolean) => {
    const keys = [
      queryKeys.votunaSuggestions(playlistId),
      queryKeys.votunaTracks(playlistId),
    ] as const
    const allKeys = includeMembers ? [...keys, queryKeys.votunaMembers(playlistId)] : keys
    await Promise.all(allKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }

  const fetchRecommendationPage = async (
    offset: number,
    nonce: string,
    limit: number,
  ): Promise<ProviderTrack[]> => {
    const query = new URLSearchParams({
      limit: String(Math.max(1, limit)),
      offset: String(Math.max(0, offset)),
    })
    if (nonce.trim()) {
      query.set('refresh_nonce', nonce.trim())
    }
    return apiJson<ProviderTrack[]>(
      `/api/v1/votuna/playlists/${playlistId}/tracks/recommendations?${query.toString()}`,
      { authRequired: true },
    )
  }

  const mergeRecommendations = (
    visible: ProviderTrack[],
    queue: ProviderTrack[],
    incoming: ProviderTrack[],
  ) => {
    const visibleNext = [...visible]
    const queueNext = [...queue]
    const seen = new Set<string>([
      ...visibleNext.map((track) => track.provider_track_id),
      ...queueNext.map((track) => track.provider_track_id),
    ])

    for (const track of incoming) {
      if (seen.has(track.provider_track_id)) continue
      seen.add(track.provider_track_id)
      queueNext.push(track)
    }

    while (visibleNext.length < VISIBLE_RECOMMENDATIONS_COUNT && queueNext.length > 0) {
      const nextTrack = queueNext.shift()
      if (!nextTrack) break
      visibleNext.push(nextTrack)
    }

    return {
      visible: visibleNext,
      queue: queueNext,
    }
  }

  const fetchRecommendations = async ({
    reset,
    nonce,
    pageSize,
  }: RecommendationFetchOptions) => {
    if (!playlistId || !isRecommendationsSupported) return
    if (!reset && (!hasMoreRecommendations || isRecommendationsLoading)) return
    const requestLimit = pageSize ?? RECOMMENDATIONS_BATCH_SIZE
    const requestOffset = reset ? 0 : recommendationsOffset
    setRecommendationsStatus('')
    setIsRecommendationsLoading(true)
    try {
      const results = await fetchRecommendationPage(requestOffset, nonce, requestLimit)
      const baseVisible = reset ? [] : recommendedTracks
      const baseQueue = reset ? [] : recommendationQueue
      const mergedRecommendations = mergeRecommendations(baseVisible, baseQueue, results)
      setRecommendedTracks(mergedRecommendations.visible)
      setRecommendationQueue(mergedRecommendations.queue)
      setRecommendationsOffset(requestOffset + results.length)
      setHasMoreRecommendations(results.length === requestLimit)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load recommendations'
      setRecommendationsStatus(message)
      if (reset) {
        setRecommendedTracks([])
        setRecommendationQueue([])
        setRecommendationsOffset(0)
        setHasMoreRecommendations(false)
      }
    } finally {
      setIsRecommendationsLoading(false)
    }
  }

  const loadInitialRecommendations = () => {
    if (!playlistId || !isRecommendationsSupported) return
    void fetchRecommendations({
      reset: true,
      nonce: recommendationsRefreshNonce,
    })
  }

  const refreshRecommendations = () => {
    if (!playlistId || !isRecommendationsSupported) return
    const nextNonce = createRefreshNonce()
    setRecommendationsRefreshNonce(nextNonce)
    setRecommendationsOffset(0)
    setHasMoreRecommendations(true)
    void fetchRecommendations({ reset: true, nonce: nextNonce })
  }

  const loadMoreRecommendations = () => {
    if (!playlistId || !isRecommendationsSupported) return
    void fetchRecommendations({
      reset: false,
      nonce: recommendationsRefreshNonce,
    })
  }

  useEffect(() => {
    if (!playlistId || !isRecommendationsSupported) {
      setRecommendedTracks([])
      setRecommendationQueue([])
      setRecommendationsStatus('')
      setRecommendationsOffset(0)
      setHasMoreRecommendations(false)
      setIsRecommendationsLoading(false)
      return
    }
    const nonce = createRefreshNonce()
    setRecommendationsRefreshNonce(nonce)
    setRecommendationsOffset(0)
    setHasMoreRecommendations(true)
    void fetchRecommendations({ reset: true, nonce })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId, isRecommendationsSupported])

  const suggestMutation = useMutation({
    mutationFn: async (payload: SuggestPayload) => {
      return apiJson<Suggestion>(`/api/v1/votuna/playlists/${playlistId}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify(payload),
      })
    },
    onSuccess: async (_data, variables) => {
      if (variables.track_url && !variables.provider_track_id) {
        setLinkSuggestionUrl('')
      }
      setSuggestStatus('')
      await invalidatePlaylistQueries(true)
    },
  })

  const directAddMutation = useMutation({
    mutationFn: async (payload: SuggestPayload) => {
      return apiJson<ProviderTrack>(`/api/v1/votuna/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify(payload),
      })
    },
    onSuccess: async (_data, variables) => {
      if (variables.track_url && !variables.provider_track_id) {
        setLinkSuggestionUrl('')
      }
      setSuggestStatus('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.votunaTracks(playlistId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.votunaMembers(playlistId) })
    },
  })

  const reactionMutation = useMutation({
    mutationFn: async ({
      suggestionId,
      reaction,
    }: {
      suggestionId: number
      reaction: 'up' | 'down'
    }) => {
      return apiJson<Suggestion>(`/api/v1/votuna/suggestions/${suggestionId}/reaction`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify({ reaction }),
      })
    },
    onSuccess: async () => {
      setSuggestionsActionStatus('')
      await invalidatePlaylistQueries(false)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to update reaction'
      setSuggestionsActionStatus(message)
    },
  })

  const cancelSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: number) => {
      return apiJson<Suggestion>(`/api/v1/votuna/suggestions/${suggestionId}/cancel`, {
        method: 'POST',
        authRequired: true,
      })
    },
    onSuccess: async () => {
      setSuggestionsActionStatus('')
      await invalidatePlaylistQueries(false)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to cancel suggestion'
      setSuggestionsActionStatus(message)
    },
  })

  const forceAddMutation = useMutation({
    mutationFn: async (suggestionId: number) => {
      return apiJson<Suggestion>(`/api/v1/votuna/suggestions/${suggestionId}/force-add`, {
        method: 'POST',
        authRequired: true,
      })
    },
    onSuccess: async () => {
      setSuggestionsActionStatus('')
      await invalidatePlaylistQueries(false)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to force add suggestion'
      setSuggestionsActionStatus(message)
    },
  })

  const removeTrackMutation = useMutation({
    mutationFn: async (providerTrackId: string) => {
      const response = await apiFetch(
        `/api/v1/votuna/playlists/${playlistId}/tracks/${encodeURIComponent(providerTrackId)}`,
        {
          method: 'DELETE',
          authRequired: true,
        },
      )
      if (response.ok) return
      const body = await response.json().catch(() => ({}))
      const detail =
        typeof body.detail === 'string'
          ? body.detail
          : 'Unable to remove track'
      throw new Error(detail)
    },
    onMutate: (providerTrackId) => {
      setTrackActionStatus('')
      setRemovingTrackId(providerTrackId)
    },
    onSuccess: async () => {
      setTrackActionStatus('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.votunaTracks(playlistId) })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to remove track'
      setTrackActionStatus(message)
    },
    onSettled: () => {
      setRemovingTrackId(null)
    },
  })

  const searchTracks = async () => {
    if (!playlistId || !searchQuery.trim()) return
    const query = searchQuery.trim()
    const requestId = latestSearchRequestIdRef.current + 1
    latestSearchRequestIdRef.current = requestId
    setSearchStatus('')
    setIsSearching(true)
    setIsSearchHydrating(false)
    let initialResults: ProviderTrack[] = []
    try {
      const baseSearchUrl = `/api/v1/votuna/playlists/${playlistId}/tracks/search?q=${encodeURIComponent(query)}&limit=8`
      const searchUrl =
        normalizedProvider === 'tidal'
          ? `${baseSearchUrl}&hydrate=false`
          : baseSearchUrl
      const results = await apiJson<ProviderTrack[]>(
        searchUrl,
        { authRequired: true },
      )
      if (requestId !== latestSearchRequestIdRef.current) return
      initialResults = results
      setSearchResults(results)
      if (results.length === 0) {
        setSearchStatus('No tracks found for that search.')
      }
    } catch (error) {
      if (requestId !== latestSearchRequestIdRef.current) return
      const message = error instanceof Error ? error.message : 'Unable to search tracks'
      setSearchStatus(message)
      setSearchResults([])
    } finally {
      if (requestId === latestSearchRequestIdRef.current) {
        setIsSearching(false)
      }
    }

    if (normalizedProvider !== 'tidal') return
    if (requestId !== latestSearchRequestIdRef.current) return
    if (initialResults.length === 0) return
    const needsHydration = initialResults.some((track) => !track.artist || !track.artwork_url)
    if (!needsHydration) return
    setIsSearchHydrating(true)

    try {
      const hydratedResults = await apiJson<ProviderTrack[]>(
        `/api/v1/votuna/playlists/${playlistId}/tracks/search?q=${encodeURIComponent(query)}&limit=8&hydrate=true`,
        { authRequired: true },
      )
      if (requestId !== latestSearchRequestIdRef.current) return
      const hydratedById = new Map(hydratedResults.map((track) => [track.provider_track_id, track]))
      setSearchResults((current) =>
        current.map((track) => {
          const hydrated = hydratedById.get(track.provider_track_id)
          if (!hydrated) return track
          return {
            ...track,
            title: hydrated.title || track.title,
            artist: hydrated.artist ?? track.artist,
            genre: hydrated.genre ?? track.genre,
            artwork_url: hydrated.artwork_url ?? track.artwork_url,
            url: hydrated.url ?? track.url,
          }
        }),
      )
    } catch {
      // Keep fast results visible when background hydration fails.
    } finally {
      if (requestId === latestSearchRequestIdRef.current) {
        setIsSearchHydrating(false)
      }
    }
  }

  const runSuggestMutation = async (payload: SuggestPayload, allowResuggest: boolean) => {
    await suggestMutation.mutateAsync({
      ...payload,
      allow_resuggest: allowResuggest,
    })
  }

  const markSearchTrackAsSuggested = (providerTrackId: string) => {
    setSuggestedSearchTrackIds((prev) => {
      if (prev.includes(providerTrackId)) return prev
      return [...prev, providerTrackId]
    })
  }

  const unmarkSearchTrackAsSuggested = (providerTrackId: string) => {
    setSuggestedSearchTrackIds((prev) => prev.filter((id) => id !== providerTrackId))
  }

  const suggestTrack = async (
    payload: SuggestPayload,
    options?: { optimisticProviderTrackId?: string },
  ): Promise<boolean> => {
    if (!isCollaborative) {
      setSuggestStatus('')
      try {
        await directAddMutation.mutateAsync(payload)
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to add track'
        setSuggestStatus(message)
        return false
      }
    }

    const optimisticProviderTrackId = options?.optimisticProviderTrackId
    if (optimisticProviderTrackId) {
      markSearchTrackAsSuggested(optimisticProviderTrackId)
    }
    setSuggestStatus('')
    try {
      await runSuggestMutation(payload, false)
      return true
    } catch (error) {
      if (isRejectedTrackConflict(error) && typeof window !== 'undefined') {
        const shouldResuggest = window.confirm(
          'This track was rejected before. Suggest it again anyway?',
        )
        if (!shouldResuggest) {
          setSuggestStatus('Suggestion canceled.')
          if (optimisticProviderTrackId) {
            unmarkSearchTrackAsSuggested(optimisticProviderTrackId)
          }
          return false
        }
        try {
          await runSuggestMutation(payload, true)
          return true
        } catch (retryError) {
          const retryMessage =
            retryError instanceof Error ? retryError.message : 'Unable to add suggestion'
          setSuggestStatus(retryMessage)
          if (optimisticProviderTrackId) {
            unmarkSearchTrackAsSuggested(optimisticProviderTrackId)
          }
          return false
        }
      }
      const message = error instanceof Error ? error.message : 'Unable to add suggestion'
      setSuggestStatus(message)
      if (optimisticProviderTrackId) {
        unmarkSearchTrackAsSuggested(optimisticProviderTrackId)
      }
      return false
    }
  }

  const suggestFromSearch = (track: ProviderTrack) => {
    void suggestTrack({
      provider_track_id: track.provider_track_id,
      track_title: track.title,
      track_artist: track.artist ?? null,
      track_artwork_url: track.artwork_url ?? null,
      track_url: track.url ?? null,
    }, { optimisticProviderTrackId: track.provider_track_id })
  }

  const suggestFromLink = () => {
    if (!playlistId || !linkSuggestionUrl.trim()) return
    void suggestTrack({
      track_url: linkSuggestionUrl.trim(),
    })
  }

  const acceptRecommendation = async (track: ProviderTrack) => {
    if (!playlistId || !isRecommendationsSupported) return
    setRecommendationsStatus('')
    setIsRecommendationActionPending(true)
    try {
      const success = await suggestTrack(
        {
          provider_track_id: track.provider_track_id,
          track_title: track.title,
          track_artist: track.artist ?? null,
          track_artwork_url: track.artwork_url ?? null,
          track_url: track.url ?? null,
        },
        { optimisticProviderTrackId: track.provider_track_id },
      )
      if (!success) return
      const nextRecommendations = recommendedTracks.filter(
        (candidate) => candidate.provider_track_id !== track.provider_track_id,
      )
      const nextQueue = recommendationQueue.filter(
        (candidate) => candidate.provider_track_id !== track.provider_track_id,
      )
      const mergedRecommendations = mergeRecommendations(nextRecommendations, nextQueue, [])
      setRecommendedTracks(mergedRecommendations.visible)
      setRecommendationQueue(mergedRecommendations.queue)
      if (
        mergedRecommendations.queue.length < RECOMMENDATIONS_QUEUE_PREFETCH_THRESHOLD &&
        hasMoreRecommendations &&
        !isRecommendationsLoading
      ) {
        void loadMoreRecommendations()
      }
    } finally {
      setIsRecommendationActionPending(false)
    }
  }

  const declineRecommendation = async (track: ProviderTrack) => {
    if (!playlistId || !isRecommendationsSupported) return
    const previousRecommendations = recommendedTracks
    const previousQueue = recommendationQueue
    const nextRecommendations = previousRecommendations.filter(
      (candidate) => candidate.provider_track_id !== track.provider_track_id,
    )
    const nextQueue = previousQueue.filter(
      (candidate) => candidate.provider_track_id !== track.provider_track_id,
    )
    const mergedRecommendations = mergeRecommendations(nextRecommendations, nextQueue, [])
    setRecommendationsStatus('')
    setIsRecommendationActionPending(true)
    setRecommendedTracks(mergedRecommendations.visible)
    setRecommendationQueue(mergedRecommendations.queue)
    try {
      const response = await apiFetch(
        `/api/v1/votuna/playlists/${playlistId}/tracks/recommendations/decline`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          authRequired: true,
          body: JSON.stringify({ provider_track_id: track.provider_track_id }),
        },
      )
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const detail =
          typeof body.detail === 'string'
            ? body.detail
            : 'Unable to decline recommendation'
        throw new Error(detail)
      }
      if (
        mergedRecommendations.queue.length < RECOMMENDATIONS_QUEUE_PREFETCH_THRESHOLD &&
        hasMoreRecommendations &&
        !isRecommendationsLoading
      ) {
        void loadMoreRecommendations()
      }
    } catch (error) {
      setRecommendedTracks(previousRecommendations)
      setRecommendationQueue(previousQueue)
      const message = error instanceof Error ? error.message : 'Unable to decline recommendation'
      setRecommendationsStatus(message)
    } finally {
      setIsRecommendationActionPending(false)
    }
  }

  const setSearchQuery = (value: string) => {
    setSearchQueryState(value)
    if (value.trim()) return
    setSearchResults([])
    setSearchStatus('')
    setIsSearchHydrating(false)
  }

  const setReaction = (suggestionId: number, reaction: 'up' | 'down') => {
    setSuggestionsActionStatus('')
    reactionMutation.mutate({ suggestionId, reaction })
  }

  const cancelSuggestion = (suggestionId: number) => {
    setSuggestionsActionStatus('')
    cancelSuggestionMutation.mutate(suggestionId)
  }

  const forceAddSuggestion = (suggestionId: number) => {
    setSuggestionsActionStatus('')
    forceAddMutation.mutate(suggestionId)
  }

  const removeTrack = (providerTrackId: string) => {
    removeTrackMutation.mutate(providerTrackId)
  }

  return {
    searchQuery,
    setSearchQuery,
    searchTracks,
    isSearching,
    isSearchHydrating,
    searchStatus,
    searchResults,
    suggestedSearchTrackIds,
    suggestStatus,
    suggestionsActionStatus,
    suggestFromSearch,
    isSuggestPending: suggestMutation.isPending || directAddMutation.isPending,
    linkSuggestionUrl,
    setLinkSuggestionUrl,
    suggestFromLink,
    setReaction,
    isReactionPending: reactionMutation.isPending,
    cancelSuggestion,
    isCancelSuggestionPending: cancelSuggestionMutation.isPending,
    forceAddSuggestion,
    isForceAddPending: forceAddMutation.isPending,
    removeTrack,
    isRemoveTrackPending: removeTrackMutation.isPending,
    removingTrackId,
    trackActionStatus,
    recommendedTracks,
    isRecommendationsSupported,
    recommendationsStatus,
    isRecommendationsLoading,
    isRecommendationActionPending,
    loadInitialRecommendations,
    refreshRecommendations,
    acceptRecommendation,
    declineRecommendation,
  }
}
