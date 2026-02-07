'use client'

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@tremor/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import CollaboratorsSection from '@/components/playlists/CollaboratorsSection'
import NowPlayingDock from '@/components/playlists/NowPlayingDock'
import PlaylistSettingsSection from '@/components/playlists/PlaylistSettingsSection'
import SearchSuggestSection from '@/components/playlists/SearchSuggestSection'
import SuggestionsSection from '@/components/playlists/SuggestionsSection'
import TracksSection from '@/components/playlists/TracksSection'
import PageShell from '@/components/ui/PageShell'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { apiJson } from '@/lib/api'
import type {
  PlayerTrack,
  PlaylistMember,
  PlaylistSettings,
  ProviderTrack,
  Suggestion,
  TrackPlayRequest,
  VotunaPlaylist,
} from '@/types/votuna'

type SettingsFormState = {
  required_vote_percent: number
  auto_add_on_threshold: boolean
}

export default function PlaylistDetailPage() {
  const params = useParams()
  const playlistId = Array.isArray(params.id) ? params.id[0] : params.id
  const queryClient = useQueryClient()

  const [settingsForm, setSettingsForm] = useState<SettingsFormState>({
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
    mutationFn: async (payload: SettingsFormState) => {
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

  const handleSettingsSave = async () => {
    if (!playlistId || !canEditSettings) return
    setSettingsStatus('')
    settingsMutation.mutate(settingsForm)
  }

  const handleSearchTracks = async () => {
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

  const handleSuggestFromSearch = (track: ProviderTrack) => {
    setSuggestStatus('')
    suggestMutation.mutate({
      provider_track_id: track.provider_track_id,
      track_title: track.title,
      track_artist: track.artist ?? null,
      track_artwork_url: track.artwork_url ?? null,
      track_url: track.url ?? null,
    })
  }

  const handleSuggestFromLink = () => {
    if (!playlistId || !linkSuggestionUrl.trim()) return
    setSuggestStatus('')
    suggestMutation.mutate({
      track_url: linkSuggestionUrl.trim(),
    })
  }

  const handlePlayTrack = ({ key, title, artist, url, artworkUrl }: TrackPlayRequest) => {
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

  const handleVote = (suggestionId: number) => {
    voteMutation.mutate(suggestionId)
  }

  if (playlistQuery.isLoading) {
    return (
      <PageShell>
        <SurfaceCard>
          <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading playlist...</p>
        </SurfaceCard>
      </PageShell>
    )
  }

  if (!playlist) {
    return (
      <PageShell>
        <SurfaceCard>
          <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Playlist not found.</p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center rounded-full bg-[rgb(var(--votuna-ink))] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-paper))]"
          >
            Back to dashboard
          </Link>
        </SurfaceCard>
      </PageShell>
    )
  }

  return (
    <PageShell className="pb-44">
      <div className="fade-up space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <SectionEyebrow>Playlist</SectionEyebrow>
            <h1 className="mt-2 text-3xl font-semibold text-[rgb(var(--votuna-ink))]">
              {playlist.title}
            </h1>
            {playlist.description ? (
              <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                {playlist.description}
              </p>
            ) : null}
          </div>
          <Link
            href="/"
            className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.15)] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-ink))] hover:bg-[rgba(var(--votuna-paper),0.7)]"
          >
            Back
          </Link>
        </div>

        <TabGroup>
          <TabList className="rounded-full bg-[rgba(var(--votuna-paper),0.85)] p-1">
            <Tab className="rounded-full px-4 py-2 text-sm">Playlist</Tab>
            <Tab className="rounded-full px-4 py-2 text-sm">Settings</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <div className="space-y-6">
                <SearchSuggestSection
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  onSearchTracks={handleSearchTracks}
                  isSearching={isSearching}
                  searchStatus={searchStatus}
                  searchResults={searchResults}
                  onPlayTrack={handlePlayTrack}
                  onSuggestFromSearch={handleSuggestFromSearch}
                  isSuggestPending={suggestMutation.isPending}
                  linkSuggestionUrl={linkSuggestionUrl}
                  onLinkSuggestionUrlChange={setLinkSuggestionUrl}
                  onSuggestFromLink={handleSuggestFromLink}
                  suggestStatus={suggestStatus}
                />

                <SuggestionsSection
                  suggestions={suggestions}
                  isLoading={suggestionsQuery.isLoading}
                  memberNameById={memberNameById}
                  onPlayTrack={handlePlayTrack}
                  onVote={handleVote}
                  isVotePending={voteMutation.isPending}
                />

                <TracksSection
                  tracks={tracks}
                  isLoading={tracksQuery.isLoading}
                  onPlayTrack={handlePlayTrack}
                />
              </div>
            </TabPanel>
            <TabPanel>
              <div className="space-y-6">
                <PlaylistSettingsSection
                  requiredVotePercent={settingsForm.required_vote_percent}
                  autoAddOnThreshold={settingsForm.auto_add_on_threshold}
                  canEditSettings={canEditSettings}
                  isSaving={settingsMutation.isPending}
                  settingsStatus={settingsStatus}
                  onSaveSettings={handleSettingsSave}
                  onRequiredVotePercentChange={(value) =>
                    setSettingsForm((prev) => ({ ...prev, required_vote_percent: value }))
                  }
                  onAutoAddOnThresholdChange={(value) =>
                    setSettingsForm((prev) => ({ ...prev, auto_add_on_threshold: value }))
                  }
                />
                <CollaboratorsSection members={members} isLoading={membersQuery.isLoading} />
              </div>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
      {activePlayerTrack ? (
        <NowPlayingDock
          track={activePlayerTrack}
          playerNonce={playerNonce}
          onClose={() => setActivePlayerTrack(null)}
        />
      ) : null}
    </PageShell>
  )
}
