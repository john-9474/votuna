import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { apiJson } from '@/lib/api'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type {
  PlayerTrack,
  PlaylistMember,
  PlaylistSettings,
  PlaylistSettingsForm,
  ProviderTrack,
  Suggestion,
  TrackPlayRequest,
  VotunaPlaylist,
} from '@/types/votuna'

export function usePlaylistDetailPage(playlistId: string | undefined) {
  const queryClient = useQueryClient()

  const [settingsForm, setSettingsForm] = useState<PlaylistSettingsForm>({
    required_vote_percent: 60,
    auto_add_on_threshold: true,
  })
  const [settingsStatus, setSettingsStatus] = useState('')

  const [suggestStatus, setSuggestStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProviderTrack[]>([])
  const [searchStatus, setSearchStatus] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [linkSuggestionUrl, setLinkSuggestionUrl] = useState('')
  const [activePlayerTrack, setActivePlayerTrack] = useState<PlayerTrack | null>(null)
  const [playerNonce, setPlayerNonce] = useState(0)

  const currentUserQuery = useCurrentUser()
  const currentUser = currentUserQuery.data ?? null

  const playlistQuery = useQuery({
    queryKey: ['votunaPlaylist', playlistId],
    queryFn: () =>
      apiJson<VotunaPlaylist>(`/api/v1/votuna/playlists/${playlistId}`, { authRequired: true }),
    enabled: !!playlistId,
    refetchInterval: 60_000,
    staleTime: 10_000,
  })

  const suggestionsQuery = useQuery({
    queryKey: ['votunaSuggestions', playlistId],
    queryFn: () =>
      apiJson<Suggestion[]>(
        `/api/v1/votuna/playlists/${playlistId}/suggestions?status=pending`,
        { authRequired: true },
      ),
    enabled: !!playlistId,
    refetchInterval: 10_000,
    staleTime: 5_000,
  })

  const tracksQuery = useQuery({
    queryKey: ['votunaTracks', playlistId],
    queryFn: () =>
      apiJson<ProviderTrack[]>(`/api/v1/votuna/playlists/${playlistId}/tracks`, {
        authRequired: true,
      }),
    enabled: !!playlistId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const membersQuery = useQuery({
    queryKey: ['votunaMembers', playlistId],
    queryFn: () =>
      apiJson<PlaylistMember[]>(`/api/v1/votuna/playlists/${playlistId}/members`, {
        authRequired: true,
      }),
    enabled: !!playlistId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const playlist = playlistQuery.data ?? null
  const settings = playlist?.settings ?? null
  const suggestions = suggestionsQuery.data ?? []
  const tracks = tracksQuery.data ?? []
  const members = membersQuery.data ?? []

  const canEditSettings = useMemo(() => {
    return Boolean(playlist && currentUser?.id && playlist.owner_user_id === currentUser.id)
  }, [playlist, currentUser])

  const memberNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const member of membersQuery.data ?? []) {
      if (member.display_name) {
        map.set(member.user_id, member.display_name)
      }
    }
    if (currentUser?.id) {
      map.set(
        currentUser.id,
        currentUser.display_name || currentUser.first_name || currentUser.email || 'You',
      )
    }
    return map
  }, [membersQuery.data, currentUser])

  useEffect(() => {
    if (!settings) return
    setSettingsForm({
      required_vote_percent: settings.required_vote_percent,
      auto_add_on_threshold: settings.auto_add_on_threshold,
    })
  }, [settings])

  const settingsMutation = useMutation({
    mutationFn: async (payload: PlaylistSettingsForm) => {
      return apiJson<PlaylistSettings>(`/api/v1/votuna/playlists/${playlistId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify(payload),
      })
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['votunaPlaylist', playlistId], (prev: VotunaPlaylist | undefined) => {
        if (!prev) return prev
        return { ...prev, settings: updated }
      })
      setSettingsStatus('Settings saved')
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to save settings'
      setSettingsStatus(message)
    },
  })

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
      await queryClient.invalidateQueries({ queryKey: ['votunaSuggestions', playlistId] })
      await queryClient.invalidateQueries({ queryKey: ['votunaMembers', playlistId] })
      await queryClient.invalidateQueries({ queryKey: ['votunaTracks', playlistId] })
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
      await queryClient.invalidateQueries({ queryKey: ['votunaSuggestions', playlistId] })
      await queryClient.invalidateQueries({ queryKey: ['votunaTracks', playlistId] })
    },
  })

  const saveSettings = () => {
    if (!playlistId || !canEditSettings) return
    setSettingsStatus('')
    settingsMutation.mutate(settingsForm)
  }

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

  const playTrack = ({ key, title, artist, url, artworkUrl }: TrackPlayRequest) => {
    if (!url) return
    setActivePlayerTrack({
      key,
      title,
      artist,
      url,
      artwork_url: artworkUrl,
    })
    setPlayerNonce((prev) => prev + 1)
  }

  const vote = (suggestionId: number) => {
    voteMutation.mutate(suggestionId)
  }

  const closePlayer = () => {
    setActivePlayerTrack(null)
  }

  return {
    playlist,
    isPlaylistLoading: playlistQuery.isLoading,
    suggestions,
    isSuggestionsLoading: suggestionsQuery.isLoading,
    tracks,
    isTracksLoading: tracksQuery.isLoading,
    members,
    isMembersLoading: membersQuery.isLoading,
    canEditSettings,
    memberNameById,
    settingsForm,
    settingsStatus,
    isSettingsSaving: settingsMutation.isPending,
    saveSettings,
    setRequiredVotePercent: (value: number) =>
      setSettingsForm((prev) => ({ ...prev, required_vote_percent: value })),
    setAutoAddOnThreshold: (value: boolean) =>
      setSettingsForm((prev) => ({ ...prev, auto_add_on_threshold: value })),
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
    playTrack,
    activePlayerTrack,
    playerNonce,
    closePlayer,
  }
}
