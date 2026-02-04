'use client'

import {
  Button,
  Card,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  TextInput,
} from '@tremor/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { apiJson, apiJsonOrNull, API_URL } from '../../../lib/api'

type User = {
  id?: number
  display_name?: string | null
  first_name?: string | null
  email?: string | null
  avatar_url?: string | null
}

type PlaylistSettings = {
  id: number
  playlist_id: number
  required_vote_percent: number
  auto_add_on_threshold: boolean
}

type VotunaPlaylist = {
  id: number
  owner_user_id: number
  title: string
  description?: string | null
  provider: string
  provider_playlist_id: string
  is_active: boolean
  settings?: PlaylistSettings | null
}

type Suggestion = {
  id: number
  provider_track_id: string
  track_title?: string | null
  track_artist?: string | null
  track_artwork_url?: string | null
  track_url?: string | null
  status: string
  vote_count: number
}

type ProviderTrack = {
  provider_track_id: string
  title: string
  artist?: string | null
  artwork_url?: string | null
  url?: string | null
}

type PlaylistMember = {
  user_id: number
  display_name?: string | null
  avatar_url?: string | null
  role: string
  joined_at: string
  suggested_count: number
}

const buildAvatarSrc = (member: PlaylistMember) => {
  if (!member.avatar_url) return ''
  const version = encodeURIComponent(member.avatar_url)
  return `${API_URL}/api/v1/users/${member.user_id}/avatar?v=${version}`
}

export default function PlaylistDetailPage() {
  const params = useParams()
  const playlistId = Array.isArray(params.id) ? params.id[0] : params.id
  const queryClient = useQueryClient()

  const [settingsForm, setSettingsForm] = useState({
    required_vote_percent: 60,
    auto_add_on_threshold: true,
  })
  const [settingsStatus, setSettingsStatus] = useState('')

  const [suggestStatus, setSuggestStatus] = useState('')
  const [suggestForm, setSuggestForm] = useState({
    provider_track_id: '',
    track_title: '',
    track_artist: '',
    track_artwork_url: '',
    track_url: '',
  })

  const currentUserQuery = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiJsonOrNull<User>('/api/v1/users/me'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
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

  useEffect(() => {
    if (!settings) return
    setSettingsForm({
      required_vote_percent: settings.required_vote_percent,
      auto_add_on_threshold: settings.auto_add_on_threshold,
    })
  }, [settings?.required_vote_percent, settings?.auto_add_on_threshold])

  const settingsMutation = useMutation({
    mutationFn: async (payload: typeof settingsForm) => {
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
    mutationFn: async () => {
      return apiJson<Suggestion>(`/api/v1/votuna/playlists/${playlistId}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify({
          provider_track_id: suggestForm.provider_track_id.trim(),
          track_title: suggestForm.track_title || null,
          track_artist: suggestForm.track_artist || null,
          track_artwork_url: suggestForm.track_artwork_url || null,
          track_url: suggestForm.track_url || null,
        }),
      })
    },
    onSuccess: async () => {
      setSuggestForm({
        provider_track_id: '',
        track_title: '',
        track_artist: '',
        track_artwork_url: '',
        track_url: '',
      })
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

  const handleSuggest = async () => {
    if (!playlistId || !suggestForm.provider_track_id.trim()) return
    setSuggestStatus('')
    suggestMutation.mutate()
  }

  const handleVote = async (suggestionId: number) => {
    voteMutation.mutate(suggestionId)
  }

  if (playlistQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
          <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading playlist...</p>
        </Card>
      </main>
    )
  }

  if (!playlist) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
          <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Playlist not found.</p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center rounded-full bg-[rgb(var(--votuna-ink))] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-paper))]"
          >
            Back to dashboard
          </Link>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="fade-up space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
              Playlist
            </p>
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
                <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                      Suggest a track
                    </p>
                    <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                      Enter a SoundCloud track ID (from the URL) and optionally add metadata.
                    </p>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <TextInput
                      value={suggestForm.provider_track_id}
                      onValueChange={(value) =>
                        setSuggestForm((prev) => ({ ...prev, provider_track_id: value }))
                      }
                      placeholder="Track ID"
                    />
                    <TextInput
                      value={suggestForm.track_title}
                      onValueChange={(value) => setSuggestForm((prev) => ({ ...prev, track_title: value }))}
                      placeholder="Track title (optional)"
                    />
                    <TextInput
                      value={suggestForm.track_artist}
                      onValueChange={(value) => setSuggestForm((prev) => ({ ...prev, track_artist: value }))}
                      placeholder="Artist (optional)"
                    />
                    <TextInput
                      value={suggestForm.track_url}
                      onValueChange={(value) => setSuggestForm((prev) => ({ ...prev, track_url: value }))}
                      placeholder="Track URL (optional)"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <TextInput
                      value={suggestForm.track_artwork_url}
                      onValueChange={(value) =>
                        setSuggestForm((prev) => ({ ...prev, track_artwork_url: value }))
                      }
                      placeholder="Artwork URL (optional)"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSuggest}
                      disabled={suggestMutation.isPending}
                      className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
                    >
                      {suggestMutation.isPending ? 'Adding...' : 'Suggest'}
                    </Button>
                  </div>
                  {suggestStatus ? (
                    <p className="mt-3 text-xs text-rose-500">{suggestStatus}</p>
                  ) : null}
                </Card>

                <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                        Active suggestions
                      </p>
                      <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                        Vote to add tracks to the playlist.
                      </p>
                    </div>
                  </div>

                  {suggestionsQuery.isLoading ? (
                    <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                      Loading suggestions...
                    </p>
                  ) : suggestions.length === 0 ? (
                    <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                      No active suggestions yet.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {suggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.8)] px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                              {suggestion.track_title || 'Untitled track'}
                            </p>
                            <p className="mt-1 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                              {suggestion.track_artist || 'Unknown artist'} - {suggestion.vote_count} votes
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button
                              onClick={() => handleVote(suggestion.id)}
                              disabled={voteMutation.isPending}
                              className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
                            >
                              Vote
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                        Current playlist songs
                      </p>
                      <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                        Tracks currently in the SoundCloud playlist.
                      </p>
                    </div>
                  </div>

                  {tracksQuery.isLoading ? (
                    <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                      Loading tracks...
                    </p>
                  ) : tracks.length === 0 ? (
                    <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                      No tracks found.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {tracks.map((track) => (
                        <div
                          key={track.provider_track_id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.8)] px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                              {track.title}
                            </p>
                            <p className="mt-1 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                              {track.artist || 'Unknown artist'}
                            </p>
                          </div>
                          {track.url ? (
                            <a
                              href={track.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-[rgb(var(--votuna-ink))] hover:underline"
                            >
                              Open
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </TabPanel>
            <TabPanel>
              <div className="space-y-6">
                <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                        Settings
                      </p>
                      <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                        Votes required to add a track automatically.
                      </p>
                    </div>
                    <Button
                      onClick={handleSettingsSave}
                      disabled={settingsMutation.isPending || !canEditSettings}
                      className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
                    >
                      {settingsMutation.isPending ? 'Saving...' : 'Save settings'}
                    </Button>
                  </div>
                  <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                        Required vote percent
                      </p>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={settingsForm.required_vote_percent}
                        disabled={!canEditSettings}
                        onChange={(event) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            required_vote_percent: Number(event.target.value),
                          }))
                        }
                        className="mt-2 w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm text-[rgb(var(--votuna-ink))] disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                        Auto-add on threshold
                      </p>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={settingsForm.auto_add_on_threshold}
                        onClick={() => {
                          if (!canEditSettings) return
                          setSettingsForm((prev) => ({
                            ...prev,
                            auto_add_on_threshold: !prev.auto_add_on_threshold,
                          }))
                        }}
                        className={`mt-3 inline-flex h-7 w-12 items-center rounded-full border transition ${
                          settingsForm.auto_add_on_threshold
                            ? 'border-transparent bg-[rgb(var(--votuna-accent))]'
                            : 'border-[color:rgb(var(--votuna-ink)/0.2)] bg-[rgba(var(--votuna-paper),0.8)]'
                        } ${canEditSettings ? '' : 'opacity-60'}`}
                        disabled={!canEditSettings}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-[rgb(var(--votuna-paper))] shadow transition ${
                            settingsForm.auto_add_on_threshold ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  {settingsStatus ? (
                    <p className="mt-4 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">{settingsStatus}</p>
                  ) : null}
                  {!canEditSettings ? (
                    <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.5)]">
                      Only the playlist owner can edit these settings.
                    </p>
                  ) : null}
                </Card>

                <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                        Collaborators
                      </p>
                      <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                        Users who have accepted the invite.
                      </p>
                    </div>
                  </div>

                  {membersQuery.isLoading ? (
                    <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                      Loading collaborators...
                    </p>
                  ) : members.length === 0 ? (
                    <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                      No collaborators yet.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {members.map((member) => {
                        const avatarSrc = buildAvatarSrc(member)
                        return (
                          <div
                            key={member.user_id}
                            className="flex items-center justify-between rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.8)] px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              {avatarSrc ? (
                                <img
                                  src={avatarSrc}
                                  alt={member.display_name || 'Collaborator avatar'}
                                  className="h-8 w-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(var(--votuna-ink),0.1)] text-xs font-semibold text-[rgb(var(--votuna-ink))]">
                                  {(member.display_name || 'U').slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                                  {member.display_name || 'Unknown user'}
                                </p>
                                <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                                  Joined {new Date(member.joined_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                                {member.suggested_count} suggested
                              </p>
                              <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                                {member.role}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Card>
              </div>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </main>
  )
}
