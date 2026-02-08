import { useMutation, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiFetch, apiJson, type ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/constants/queryKeys'
import type { ProviderTrack, Suggestion } from '@/lib/types/votuna'

type UsePlaylistInteractionsArgs = {
  playlistId: string | undefined
  queryClient: QueryClient
}

type SuggestPayload = {
  provider_track_id?: string
  track_title?: string | null
  track_artist?: string | null
  track_artwork_url?: string | null
  track_url?: string | null
  allow_resuggest?: boolean
}

const REJECTED_TRACK_ERROR_CODE = 'TRACK_PREVIOUSLY_REJECTED'

function isRejectedTrackConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const apiError = error as ApiError
  if (apiError.status !== 409) return false
  const detail = apiError.rawDetail as { code?: string } | undefined
  if (detail?.code === REJECTED_TRACK_ERROR_CODE) return true
  return error.message.toLowerCase().includes('previously rejected')
}

export function usePlaylistInteractions({ playlistId, queryClient }: UsePlaylistInteractionsArgs) {
  const [suggestStatus, setSuggestStatus] = useState('')
  const [suggestionsActionStatus, setSuggestionsActionStatus] = useState('')
  const [trackActionStatus, setTrackActionStatus] = useState('')
  const [searchQuery, setSearchQueryState] = useState('')
  const [searchResults, setSearchResults] = useState<ProviderTrack[]>([])
  const [suggestedSearchTrackIds, setSuggestedSearchTrackIds] = useState<string[]>([])
  const [searchStatus, setSearchStatus] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [linkSuggestionUrl, setLinkSuggestionUrl] = useState('')
  const [removingTrackId, setRemovingTrackId] = useState<string | null>(null)

  const invalidatePlaylistQueries = async (includeMembers: boolean) => {
    const keys = [
      queryKeys.votunaSuggestions(playlistId),
      queryKeys.votunaTracks(playlistId),
    ] as const
    const allKeys = includeMembers ? [...keys, queryKeys.votunaMembers(playlistId)] : keys
    await Promise.all(allKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }

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
    setSearchStatus('')
    setIsSearching(true)
    try {
      const results = await apiJson<ProviderTrack[]>(
        `/api/v1/votuna/playlists/${playlistId}/tracks/search?q=${encodeURIComponent(searchQuery.trim())}&limit=8`,
        { authRequired: true },
      )
      setSearchResults(results)
      if (results.length === 0) {
        setSearchStatus('No tracks found for that search.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to search tracks'
      setSearchStatus(message)
      setSearchResults([])
    } finally {
      setIsSearching(false)
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
  ) => {
    const optimisticProviderTrackId = options?.optimisticProviderTrackId
    if (optimisticProviderTrackId) {
      markSearchTrackAsSuggested(optimisticProviderTrackId)
    }
    setSuggestStatus('')
    try {
      await runSuggestMutation(payload, false)
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
          return
        }
        try {
          await runSuggestMutation(payload, true)
          return
        } catch (retryError) {
          const retryMessage =
            retryError instanceof Error ? retryError.message : 'Unable to add suggestion'
          setSuggestStatus(retryMessage)
          if (optimisticProviderTrackId) {
            unmarkSearchTrackAsSuggested(optimisticProviderTrackId)
          }
          return
        }
      }
      const message = error instanceof Error ? error.message : 'Unable to add suggestion'
      setSuggestStatus(message)
      if (optimisticProviderTrackId) {
        unmarkSearchTrackAsSuggested(optimisticProviderTrackId)
      }
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

  const setSearchQuery = (value: string) => {
    setSearchQueryState(value)
    if (value.trim()) return
    setSearchResults([])
    setSearchStatus('')
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
    searchStatus,
    searchResults,
    suggestedSearchTrackIds,
    suggestStatus,
    suggestionsActionStatus,
    suggestFromSearch,
    isSuggestPending: suggestMutation.isPending,
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
  }
}
