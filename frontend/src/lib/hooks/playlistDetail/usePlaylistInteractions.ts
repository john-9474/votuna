import { useMutation, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { queryKeys } from '@/lib/constants/queryKeys'
import { apiJson } from '@/lib/api'
import type { ProviderTrack, Suggestion } from '@/lib/types/votuna'

type UsePlaylistInteractionsArgs = {
  playlistId: string | undefined
  queryClient: QueryClient
}

export function usePlaylistInteractions({ playlistId, queryClient }: UsePlaylistInteractionsArgs) {
  const [suggestStatus, setSuggestStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProviderTrack[]>([])
  const [searchStatus, setSearchStatus] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [linkSuggestionUrl, setLinkSuggestionUrl] = useState('')

  const invalidatePlaylistQueries = async (includeMembers: boolean) => {
    const keys = [
      queryKeys.votunaSuggestions(playlistId),
      queryKeys.votunaTracks(playlistId),
    ] as const
    const allKeys = includeMembers ? [...keys, queryKeys.votunaMembers(playlistId)] : keys
    await Promise.all(allKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }

  const suggestMutation = useMutation({
    mutationFn: async (payload: {
      provider_track_id?: string
      track_title?: string | null
      track_artist?: string | null
      track_artwork_url?: string | null
      track_url?: string | null
    }) => {
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
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to add suggestion'
      setSuggestStatus(message)
    },
  })

  const voteMutation = useMutation({
    mutationFn: async (suggestionId: number) => {
      return apiJson<Suggestion>(`/api/v1/votuna/suggestions/${suggestionId}/vote`, {
        method: 'POST',
        authRequired: true,
      })
    },
    onSuccess: async () => {
      await invalidatePlaylistQueries(false)
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

  const suggestFromSearch = (track: ProviderTrack) => {
    setSuggestStatus('')
    suggestMutation.mutate({
      provider_track_id: track.provider_track_id,
      track_title: track.title,
      track_artist: track.artist ?? null,
      track_artwork_url: track.artwork_url ?? null,
      track_url: track.url ?? null,
    })
  }

  const suggestFromLink = () => {
    if (!playlistId || !linkSuggestionUrl.trim()) return
    setSuggestStatus('')
    suggestMutation.mutate({
      track_url: linkSuggestionUrl.trim(),
    })
  }

  const vote = (suggestionId: number) => {
    voteMutation.mutate(suggestionId)
  }

  return {
    searchQuery,
    setSearchQuery,
    searchTracks,
    isSearching,
    searchStatus,
    searchResults,
    suggestStatus,
    suggestFromSearch,
    isSuggestPending: suggestMutation.isPending,
    linkSuggestionUrl,
    setLinkSuggestionUrl,
    suggestFromLink,
    vote,
    isVotePending: voteMutation.isPending,
  }
}
