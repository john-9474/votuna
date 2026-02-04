'use client'

import { Button, Card, TextInput } from '@tremor/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { apiJson, apiJsonOrNull, ApiError } from '../lib/api'

type User = {
  id?: number
  display_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

type ProviderPlaylist = {
  provider: string
  provider_playlist_id: string
  title: string
  description?: string | null
  image_url?: string | null
  track_count?: number | null
  is_public?: boolean | null
}

type VotunaPlaylist = {
  id: number
  provider: string
  provider_playlist_id: string
  title: string
}

/** Landing page hero content. */
function Landing() {
  return (
    <main className="relative overflow-hidden">
      <div className="mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-6xl flex-col justify-center gap-10 px-6 py-16 lg:flex-row lg:items-center">
        <div className="fade-up space-y-6 lg:w-3/5">
          <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2 text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.55)] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[rgb(var(--votuna-accent))]" />
            Beta
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-[rgb(var(--votuna-ink))] sm:text-6xl">
            Run votes that feel fast, fair, and human.
          </h1>
          <p className="text-lg text-[color:rgb(var(--votuna-ink)/0.7)] sm:text-xl">
            Votuna helps you launch opinion checks, pulse surveys, and playlists votes with a clean
            login flow and a calm, focused UI.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-[color:rgb(var(--votuna-ink)/0.55)]">
            <span className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2">
              SoundCloud ready
            </span>
            <span className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2">
              Spotify coming soon
            </span>
            <span className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2">
              Secure sessions
            </span>
          </div>
        </div>

        <div className="fade-up-delay lg:w-2/5">
          <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                  Quick start
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--votuna-ink))]">
                  Invite your crew
                </h2>
                <p className="mt-3 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                  Share a single link, collect votes, and keep the momentum moving.
                </p>
              </div>
              <div className="grid gap-4 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                <div className="rounded-2xl border border-orange-100 bg-[rgba(var(--votuna-accent-soft),0.5)] p-4">
                  <p className="text-[color:rgb(var(--votuna-ink)/0.55)]">Login provider</p>
                  <p className="mt-2 text-base font-semibold text-[rgb(var(--votuna-ink))]">SoundCloud</p>
                </div>
                <div className="rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.8)] p-4">
                  <p className="text-[color:rgb(var(--votuna-ink)/0.55)]">Default flow</p>
                  <p className="mt-2 text-base font-semibold text-[rgb(var(--votuna-ink))]">API + Frontend</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  )
}

export default function Home() {
  const queryClient = useQueryClient()
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('')
  const [newPlaylistIsPublic, setNewPlaylistIsPublic] = useState(false)
  const [actionError, setActionError] = useState('')
  const [enabling, setEnabling] = useState<Record<string, boolean>>({})

  const userQuery = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiJsonOrNull<User>('/api/v1/users/me'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const user = userQuery.data ?? null

  const providerQuery = useQuery({
    queryKey: ['providerPlaylists', 'soundcloud'],
    queryFn: () =>
      apiJson<ProviderPlaylist[]>('/api/v1/playlists/providers/soundcloud', { authRequired: true }),
    enabled: !!user?.id,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const votunaQuery = useQuery({
    queryKey: ['votunaPlaylists'],
    queryFn: () => apiJson<VotunaPlaylist[]>('/api/v1/votuna/playlists', { authRequired: true }),
    enabled: !!user?.id,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const providerPlaylists = providerQuery.data ?? []
  const votunaPlaylists = votunaQuery.data ?? []
  const playlistsLoading = providerQuery.isLoading || votunaQuery.isLoading

  const votunaMap = useMemo(() => {
    return new Map(
      votunaPlaylists.map((playlist) => [
        `${playlist.provider}:${playlist.provider_playlist_id}`,
        playlist,
      ]),
    )
  }, [votunaPlaylists])

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiJson<VotunaPlaylist>('/api/v1/votuna/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify({
          provider: 'soundcloud',
          title: newPlaylistTitle.trim(),
          is_public: newPlaylistIsPublic,
        }),
      })
    },
    onMutate: () => {
      setActionError('')
    },
    onSuccess: () => {
      setNewPlaylistTitle('')
      queryClient.invalidateQueries({ queryKey: ['providerPlaylists'] })
      queryClient.invalidateQueries({ queryKey: ['votunaPlaylists'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to create playlist'
      setActionError(message)
    },
  })

  const enableMutation = useMutation({
    mutationFn: async (playlist: ProviderPlaylist) => {
      return apiJson<VotunaPlaylist>('/api/v1/votuna/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify({
          provider: playlist.provider,
          provider_playlist_id: playlist.provider_playlist_id,
        }),
      })
    },
    onMutate: (playlist) => {
      setActionError('')
      setEnabling((prev) => ({ ...prev, [playlist.provider_playlist_id]: true }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providerPlaylists'] })
      queryClient.invalidateQueries({ queryKey: ['votunaPlaylists'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to enable Votuna'
      setActionError(message)
    },
    onSettled: (_data, _error, playlist) => {
      if (!playlist) return
      setEnabling((prev) => ({ ...prev, [playlist.provider_playlist_id]: false }))
    },
  })

  if (userQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
          <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading session...</p>
        </Card>
      </main>
    )
  }

  if (!user) {
    return <Landing />
  }

  const queryError = (providerQuery.error || votunaQuery.error) as ApiError | null
  const errorMessage = actionError || queryError?.detail || queryError?.message || ''

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="fade-up space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[rgb(var(--votuna-ink))]">
            Your playlists
          </h1>
        </div>

        <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                New Votuna playlist
              </p>
              <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                Create a SoundCloud playlist and enable voting immediately.
              </p>
            </div>
            <div className="flex w-full max-w-md flex-wrap items-center gap-3">
              <TextInput
                value={newPlaylistTitle}
                onValueChange={setNewPlaylistTitle}
                placeholder="Playlist title"
                className="flex-1 bg-[rgba(var(--votuna-paper),0.85)] text-[rgb(var(--votuna-ink))]"
              />
              <div className="flex items-center gap-3 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                <button
                  type="button"
                  role="switch"
                  aria-checked={newPlaylistIsPublic}
                  onClick={() => setNewPlaylistIsPublic((prev) => !prev)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                    newPlaylistIsPublic
                      ? 'border-transparent bg-[rgb(var(--votuna-accent))]'
                      : 'border-[color:rgb(var(--votuna-ink)/0.2)] bg-[rgba(var(--votuna-paper),0.8)]'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-[rgb(var(--votuna-paper))] shadow transition ${
                      newPlaylistIsPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span>{newPlaylistIsPublic ? 'Public' : 'Private'}</span>
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newPlaylistTitle.trim()}
                className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
          {errorMessage ? <p className="mt-4 text-xs text-rose-500">{errorMessage}</p> : null}
        </Card>

        <div className="grid gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[rgb(var(--votuna-ink))]">SoundCloud</h2>
          </div>

          {playlistsLoading ? (
            <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
              <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading playlists...</p>
            </Card>
          ) : providerPlaylists.length === 0 ? (
            <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
              <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">No playlists found.</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {providerPlaylists.map((playlist) => {
                const key = `${playlist.provider}:${playlist.provider_playlist_id}`
                const votuna = votunaMap.get(key)
                return (
                  <Card
                    key={playlist.provider_playlist_id}
                    className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-5 shadow-xl shadow-black/5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-[rgb(var(--votuna-ink))]">
                          {playlist.title}
                        </p>
                        <p className="mt-1 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                          {playlist.track_count ?? 0} tracks
                          {playlist.is_public === undefined || playlist.is_public === null
                            ? ''
                            : playlist.is_public
                              ? ' - Public'
                              : ' - Private'}
                        </p>
                      </div>
                      {votuna ? (
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-[rgba(var(--votuna-accent-soft),0.7)] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-ink))]">
                            Votuna enabled
                          </span>
                          <Link
                            href={`/playlists/${votuna.id}`}
                            className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.15)] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-ink))] hover:bg-[rgba(var(--votuna-paper),0.7)]"
                          >
                            Open
                          </Link>
                        </div>
                      ) : (
                        <Button
                          onClick={() => enableMutation.mutate(playlist)}
                          disabled={enabling[playlist.provider_playlist_id]}
                          className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
                        >
                          {enabling[playlist.provider_playlist_id] ? 'Enabling...' : 'Enable Votuna'}
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
