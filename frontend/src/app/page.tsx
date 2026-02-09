'use client'

import { Button, Card } from '@tremor/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { queryKeys } from '@/lib/constants/queryKeys'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import type { PendingInvite, VotunaPlaylist } from '@/lib/types/votuna'
import ClearableTextInput from '@/components/ui/ClearableTextInput'
import { apiFetch, apiJson, ApiError } from '../lib/api'

type ProviderPlaylist = {
  provider: string
  provider_playlist_id: string
  title: string
  description?: string | null
  image_url?: string | null
  track_count?: number | null
  is_public?: boolean | null
}

const EMPTY_PROVIDER_PLAYLISTS: ProviderPlaylist[] = []
const EMPTY_VOTUNA_PLAYLISTS: VotunaPlaylist[] = []
const EMPTY_PENDING_INVITES: PendingInvite[] = []

/** Landing page hero content. */
function Landing() {
  const statusItems = [
    'SoundCloud login',
    'Create playlists (public or private)',
    'Enable existing SoundCloud playlists for voting',
    'Search tracks and suggest by link',
    'Vote counts with voter names in tooltips',
    'Playlist settings and collaborator list',
    'Manage tab for import/export between playlists',
    'Preview transfers with duplicate and failure summary',
  ]

  const featureCards = [
    {
      title: 'Playlist dashboard',
      description:
        'View SoundCloud playlists, create a new one, or enable an existing one.',
      detail: 'New playlists support public/private mode.',
    },
    {
      title: 'Search and suggest',
      description:
        'Search SoundCloud tracks inside a playlist and suggest them without leaving the page.',
      detail: 'Direct track URL suggestions are also supported.',
    },
    {
      title: 'Voting workflow',
      description: 'Members vote on active suggestions and each suggestion tracks its vote total.',
      detail: 'Tooltip displays who voted.',
    },
    {
      title: 'Player dock',
      description: 'Play tracks from search results, suggestions, and current playlist tracks.',
      detail: 'The now-playing panel stays docked at the bottom.',
    },
    {
      title: 'Playlist controls',
      description: 'Owners can set required vote percent and auto-add behavior per playlist.',
      detail: 'Collaborator panel shows roles and suggestion counts.',
    },
    {
      title: 'Playlist management',
      description:
        'Owners can copy tracks between playlists with import/export flows and a preview step.',
      detail:
        'Filter transfers by all tracks, genre, artist, or selected songs. Export supports existing or new destination playlists.',
    },
    {
      title: 'User profile',
      description: 'Edit profile fields, avatar, theme, and email preference settings.',
      detail: 'Updates sync across the app.',
    },
  ]

  const workflowSteps = [
    'Log in with SoundCloud.',
    'Create or enable a playlist on your dashboard.',
    'Invite people to suggest tracks and vote.',
    'Use the Manage tab to import/export tracks with preview before execution.',
  ]

  const plannedFeatureGroups = [
    {
      title: 'More music providers',
      items: [
        'Spotify login and playlist import',
        'Apple Music login and playlist import',
        'TIDAL login and playlist import',
        'Cross-provider playlist links and metadata sync',
      ],
    },
    {
      title: 'Playlist management tools',
      items: [
        'Bulk remove selected tracks from a playlist',
        'Duplicate cleanup utility for provider playlists',
        'Reorder tools (manual and auto-sort presets)',
        'Merge history, undo checkpoints, and replay options',
      ],
    },
    {
      title: 'Collaboration and automation',
      items: [
        'Role-based moderation actions for collaborators',
        'Duplicate detection and quality rules',
        'Playlist activity feed and vote history export',
        'Webhook events for bots and external workflows',
      ],
    },
  ]

  return (
    <main className="relative overflow-hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pt-6 lg:flex-row lg:items-start">
        <div className="fade-up space-y-6 lg:w-3/5">
          <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2 text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.55)] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[rgb(var(--votuna-accent))]" />
            Alpha
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-[rgb(var(--votuna-ink))] sm:text-6xl">
            Open source playlist voting for SoundCloud.
          </h1>
          <p className="text-lg text-[color:rgb(var(--votuna-ink)/0.7)] sm:text-xl">
            Votuna helps groups suggest tracks, vote together, and manage what gets added next.
          </p>
          <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
            Use <span className="font-semibold">Log in</span> in the top-right to connect
            SoundCloud and start.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-[color:rgb(var(--votuna-ink)/0.55)]">
            <span className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2">
              FastAPI backend
            </span>
            <span className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2">
              Next.js frontend
            </span>
            <span className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2">
              SoundCloud now, more providers later
            </span>
          </div>
        </div>

        <div className="fade-up-delay lg:w-2/5">
          <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                  Summary
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--votuna-ink))]">
                  Current features
                </h2>
              </div>
              <ul className="space-y-2 text-sm text-[color:rgb(var(--votuna-ink)/0.75)]">
                {statusItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[rgb(var(--votuna-accent))]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-8">
        <Card className="fade-up-delay rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                Overview
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--votuna-ink))]">
                Current features
              </h2>
            </div>
            <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
              Based on functionality that is available today.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.8)] p-4"
              >
                <p className="text-base font-semibold text-[rgb(var(--votuna-ink))]">{feature.title}</p>
                <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.72)]">
                  {feature.description}
                </p>
                <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">{feature.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="fade-up-delay-lg mt-6 rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
          <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
            How it works
          </p>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {workflowSteps.map((step, index) => (
              <li
                key={step}
                className="flex items-center gap-3 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.8)] px-4 py-3 text-sm text-[color:rgb(var(--votuna-ink)/0.75)]"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--votuna-accent-soft),0.9)] text-xs font-semibold text-[rgb(var(--votuna-ink))]">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="fade-up-delay-lg mt-6 rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                Roadmap
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--votuna-ink))]">
                Planned features
              </h2>
            </div>
            <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
              Priority and scope may change as development continues.
            </p>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            {plannedFeatureGroups.map((group) => (
              <div
                key={group.title}
                className="rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.8)] p-4"
              >
                <p className="text-base font-semibold text-[rgb(var(--votuna-ink))]">{group.title}</p>
                <ul className="mt-3 space-y-2 text-sm text-[color:rgb(var(--votuna-ink)/0.72)]">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--votuna-accent))]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        
      </div>
    </main>
  )
}

export default function Home() {
  const queryClient = useQueryClient()
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('')
  const [newPlaylistIsPublic, setNewPlaylistIsPublic] = useState(false)
  const [playlistActionError, setPlaylistActionError] = useState('')
  const [inviteActionError, setInviteActionError] = useState('')
  const [enabling, setEnabling] = useState<Record<string, boolean>>({})
  const [pendingInviteActions, setPendingInviteActions] = useState<Record<number, 'accept' | 'decline'>>({})

  const userQuery = useCurrentUser()
  const user = userQuery.data ?? null

  const providerQuery = useQuery({
    queryKey: queryKeys.providerPlaylistsByProvider('soundcloud'),
    queryFn: () =>
      apiJson<ProviderPlaylist[]>('/api/v1/playlists/providers/soundcloud', { authRequired: true }),
    enabled: !!user?.id,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const votunaQuery = useQuery({
    queryKey: queryKeys.votunaPlaylists,
    queryFn: () => apiJson<VotunaPlaylist[]>('/api/v1/votuna/playlists', { authRequired: true }),
    enabled: !!user?.id,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const pendingInvitesQuery = useQuery({
    queryKey: queryKeys.votunaPendingInvites,
    queryFn: () => apiJson<PendingInvite[]>('/api/v1/votuna/invites/pending', { authRequired: true }),
    enabled: !!user?.id,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const providerPlaylists = providerQuery.data ?? EMPTY_PROVIDER_PLAYLISTS
  const votunaPlaylists = votunaQuery.data ?? EMPTY_VOTUNA_PLAYLISTS
  const pendingInvites = pendingInvitesQuery.data ?? EMPTY_PENDING_INVITES
  const providerDashboardLoading = providerQuery.isLoading || votunaQuery.isLoading

  const votunaMap = useMemo(() => {
    return new Map(
      votunaPlaylists.map((playlist) => [
        `${playlist.provider}:${playlist.provider_playlist_id}`,
        playlist,
      ]),
    )
  }, [votunaPlaylists])

  const collaboratorVotunaPlaylists = useMemo(
    () => votunaPlaylists.filter((playlist) => playlist.owner_user_id !== user?.id),
    [votunaPlaylists, user?.id],
  )

  const clearPendingInviteAction = (inviteId: number) => {
    setPendingInviteActions((prev) => {
      const next = { ...prev }
      delete next[inviteId]
      return next
    })
  }

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
      setPlaylistActionError('')
    },
    onSuccess: () => {
      setNewPlaylistTitle('')
      queryClient.invalidateQueries({ queryKey: queryKeys.providerPlaylistsRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.votunaPlaylists })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to create playlist'
      setPlaylistActionError(message)
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
      setPlaylistActionError('')
      setEnabling((prev) => ({ ...prev, [playlist.provider_playlist_id]: true }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.providerPlaylistsRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.votunaPlaylists })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to enable Votuna'
      setPlaylistActionError(message)
    },
    onSettled: (_data, _error, playlist) => {
      if (!playlist) return
      setEnabling((prev) => ({ ...prev, [playlist.provider_playlist_id]: false }))
    },
  })

  const acceptInviteMutation = useMutation({
    mutationFn: async (inviteId: number) =>
      apiJson<VotunaPlaylist>(`/api/v1/votuna/invites/${inviteId}/accept`, {
        method: 'POST',
        authRequired: true,
      }),
    onMutate: (inviteId) => {
      setInviteActionError('')
      setPendingInviteActions((prev) => ({ ...prev, [inviteId]: 'accept' }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.votunaPendingInvites })
      queryClient.invalidateQueries({ queryKey: queryKeys.votunaPlaylists })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to accept invite'
      setInviteActionError(message)
    },
    onSettled: (_data, _error, inviteId) => {
      if (typeof inviteId !== 'number') return
      clearPendingInviteAction(inviteId)
    },
  })

  const declineInviteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      const response = await apiFetch(`/api/v1/votuna/invites/${inviteId}/decline`, {
        method: 'POST',
        authRequired: true,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const message = typeof body.detail === 'string' ? body.detail : 'Unable to decline invite'
        const error: ApiError = new Error(message)
        error.status = response.status
        error.detail = message
        throw error
      }
      return inviteId
    },
    onMutate: (inviteId) => {
      setInviteActionError('')
      setPendingInviteActions((prev) => ({ ...prev, [inviteId]: 'decline' }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.votunaPendingInvites })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to decline invite'
      setInviteActionError(message)
    },
    onSettled: (_data, _error, inviteId) => {
      if (typeof inviteId !== 'number') return
      clearPendingInviteAction(inviteId)
    },
  })

  if (userQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 pt-6 pb-16">
        <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
          <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading session...</p>
        </Card>
      </main>
    )
  }

  if (!user) {
    return <Landing />
  }

  const playlistQueryError = (providerQuery.error || votunaQuery.error) as ApiError | null
  const playlistQueryErrorMessage = playlistQueryError?.detail || playlistQueryError?.message || ''
  const playlistErrorMessage = playlistActionError || playlistQueryErrorMessage
  const pendingInvitesQueryError = pendingInvitesQuery.error as ApiError | null
  const pendingInvitesErrorMessage =
    inviteActionError || pendingInvitesQueryError?.detail || pendingInvitesQueryError?.message || ''
  const isCollaboratorSectionLoading = votunaQuery.isLoading || pendingInvitesQuery.isLoading
  const hasCollaboratorContent = collaboratorVotunaPlaylists.length > 0 || pendingInvites.length > 0
  const shouldShowCollaboratorSection = isCollaboratorSectionLoading || hasCollaboratorContent

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-6">
      <div className="fade-up space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[rgb(var(--votuna-ink))]">
            Playlist dashboard
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
              <ClearableTextInput
                value={newPlaylistTitle}
                onValueChange={setNewPlaylistTitle}
                placeholder="Playlist title"
                containerClassName="flex-1"
                className="bg-[rgba(var(--votuna-paper),0.85)] text-[rgb(var(--votuna-ink))]"
                clearAriaLabel="Clear playlist title"
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
          {playlistErrorMessage ? <p className="mt-4 text-xs text-rose-500">{playlistErrorMessage}</p> : null}
        </Card>

        {shouldShowCollaboratorSection ? (
          <div className="grid gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[rgb(var(--votuna-ink))]">Collaborator playlists</h2>
            </div>
            {isCollaboratorSectionLoading ? (
              <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
                <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading collaborator playlists...</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {collaboratorVotunaPlaylists.map((playlist) => (
                  <Card
                    key={playlist.id}
                    className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-5 shadow-xl shadow-black/5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-[rgb(var(--votuna-ink))]">{playlist.title}</p>
                        <p className="mt-1 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                          Shared via {playlist.provider}
                        </p>
                      </div>
                      <Link
                        href={`/playlists/${playlist.id}`}
                        className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.15)] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-ink))] hover:bg-[rgba(var(--votuna-paper),0.7)]"
                      >
                        Open
                      </Link>
                    </div>
                  </Card>
                ))}
                {pendingInvites.map((invite) => {
                  const action = pendingInviteActions[invite.invite_id]
                  const isAccepting = action === 'accept'
                  const isDeclining = action === 'decline'
                  return (
                    <Card
                      key={invite.invite_id}
                      className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-5 shadow-xl shadow-black/5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-[rgb(var(--votuna-ink))]">{invite.playlist_title}</p>
                          <p className="mt-1 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                            Pending invite from {invite.owner_display_name || `User ${invite.owner_user_id}`}
                          </p>
                          <p className="mt-1 text-xs text-[color:rgb(var(--votuna-ink)/0.5)]">
                            {invite.expires_at
                              ? `Expires ${new Date(invite.expires_at).toLocaleDateString()}`
                              : 'No expiry'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={() => acceptInviteMutation.mutate(invite.invite_id)}
                            disabled={Boolean(action)}
                            className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
                          >
                            {isAccepting ? 'Accepting...' : 'Accept'}
                          </Button>
                          <Button
                            onClick={() => declineInviteMutation.mutate(invite.invite_id)}
                            disabled={Boolean(action)}
                            className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.16)] bg-transparent text-[rgb(var(--votuna-ink))] hover:bg-[rgba(var(--votuna-paper),0.95)]"
                          >
                            {isDeclining ? 'Declining...' : 'Decline'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
            {pendingInvitesErrorMessage ? <p className="text-xs text-rose-500">{pendingInvitesErrorMessage}</p> : null}
          </div>
        ) : null}

        <div className="grid gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[rgb(var(--votuna-ink))]">Your playlists</h2>
          </div>

          {providerDashboardLoading ? (
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
