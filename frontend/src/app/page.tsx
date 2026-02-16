'use client'

import { Col, Grid, Switch, Text } from '@tremor/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { queryKeys } from '@/lib/constants/queryKeys'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { getProviderPlaylistUrl } from '@/lib/providerLinks'
import type { PendingInvite, VotunaPlaylist } from '@/lib/types/votuna'
import AppButton from '@/components/ui/AppButton'
import AppPanelRow from '@/components/ui/AppPanelRow'
import AppRouteButton from '@/components/ui/AppRouteButton'
import AppSectionHeader from '@/components/ui/AppSectionHeader'
import ClearableTextInput from '@/components/ui/ClearableTextInput'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import StatusCallout from '@/components/ui/StatusCallout'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { apiFetch, apiJson, ApiError } from '../lib/api'

type ProviderPlaylist = {
  provider: string
  provider_playlist_id: string
  title: string
  description?: string | null
  image_url?: string | null
  url?: string | null
  track_count?: number | null
  is_public?: boolean | null
}

const EMPTY_PROVIDER_PLAYLISTS: ProviderPlaylist[] = []
const EMPTY_VOTUNA_PLAYLISTS: VotunaPlaylist[] = []
const EMPTY_PENDING_INVITES: PendingInvite[] = []

const getProviderLabel = (provider: string | null | undefined) => {
  const normalized = (provider || '').trim().toLowerCase()
  if (normalized === 'spotify') return 'Spotify'
  if (normalized === 'soundcloud') return 'SoundCloud'
  if (normalized === 'apple') return 'Apple Music'
  if (normalized === 'tidal') return 'TIDAL'
  return 'Music provider'
}

/** Landing page hero content. */
function Landing() {
  const statusItems = [
    'Spotify and SoundCloud login',
    'Create playlists (public or private)',
    'Enable existing provider playlists for voting',
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
        'View provider playlists, create a new one, or enable an existing one.',
      detail: 'New playlists support public/private mode.',
    },
    {
      title: 'Search and suggest',
      description:
        'Search provider tracks inside a playlist and suggest them without leaving the page.',
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
    'Log in with Spotify or SoundCloud.',
    'Create or enable a playlist on your dashboard.',
    'Invite people to suggest tracks and vote.',
    'Use the Manage tab to import/export tracks with preview before execution.',
  ]

  const plannedFeatureGroups = [
    {
      title: 'More music providers',
      items: [
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
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <Grid className="gap-10" numItems={1} numItemsLg={5}>
          <Col numColSpanLg={3} className="fade-up space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2 text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.55)] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[rgb(var(--votuna-accent))]" />
              Alpha
            </div>
            <h1 className="text-5xl font-semibold tracking-tight text-[rgb(var(--votuna-ink))] sm:text-6xl">
              Open source playlist voting for Spotify and SoundCloud.
            </h1>
            <Text className="text-lg text-[color:rgb(var(--votuna-ink)/0.7)] sm:text-xl">
              Votuna helps groups suggest tracks, vote together, and manage what gets added next.
            </Text>
            <Text className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
              Use <span className="font-semibold">Log in</span> in the top-right to connect your
              provider and start.
            </Text>
            <div className="flex flex-wrap gap-3 text-sm text-[color:rgb(var(--votuna-ink)/0.55)]">
              <span className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2">
                FastAPI backend
              </span>
              <span className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2">
                Next.js frontend
              </span>
              <span className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2">
                Spotify and SoundCloud support
              </span>
            </div>
          </Col>

          <Col numColSpanLg={2} className="fade-up-delay">
            <SurfaceCard>
              <div className="space-y-6">
                <AppSectionHeader eyebrow="Summary" title="Current features" />
                <ul className="space-y-2 text-sm text-[color:rgb(var(--votuna-ink)/0.75)]">
                  {statusItems.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-[rgb(var(--votuna-accent))]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </SurfaceCard>
          </Col>
        </Grid>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-8">
        <SurfaceCard className="fade-up-delay">
          <AppSectionHeader
            eyebrow="Overview"
            title="Current features"
            description="Based on functionality that is available today."
          />

          <Grid className="mt-6 gap-4" numItems={1} numItemsMd={2} numItemsLg={3}>
            {featureCards.map((feature) => (
              <AppPanelRow key={feature.title} className="p-4">
                <Text className="text-base font-semibold text-[rgb(var(--votuna-ink))]">{feature.title}</Text>
                <Text className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.72)]">
                  {feature.description}
                </Text>
                <Text className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">{feature.detail}</Text>
              </AppPanelRow>
            ))}
          </Grid>
        </SurfaceCard>

        <SurfaceCard className="fade-up-delay-lg mt-6">
          <AppSectionHeader eyebrow="How it works" />
          <Grid className="mt-4 gap-3" numItems={1} numItemsMd={2}>
            {workflowSteps.map((step, index) => (
              <AppPanelRow
                key={step}
                className="flex items-center gap-3 text-sm text-[color:rgb(var(--votuna-ink)/0.75)]"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--votuna-accent-soft),0.9)] text-xs font-semibold text-[rgb(var(--votuna-ink))]">
                  {index + 1}
                </span>
                <span>{step}</span>
              </AppPanelRow>
            ))}
          </Grid>
        </SurfaceCard>

        <SurfaceCard className="fade-up-delay-lg mt-6">
          <AppSectionHeader
            eyebrow="Roadmap"
            title="Planned features"
            description="Priority and scope may change as development continues."
          />

          <Grid className="mt-6 gap-4" numItems={1} numItemsLg={3}>
            {plannedFeatureGroups.map((group) => (
              <AppPanelRow key={group.title} className="p-4">
                <Text className="text-base font-semibold text-[rgb(var(--votuna-ink))]">{group.title}</Text>
                <ul className="mt-3 space-y-2 text-sm text-[color:rgb(var(--votuna-ink)/0.72)]">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--votuna-accent))]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </AppPanelRow>
            ))}
          </Grid>
        </SurfaceCard>
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
  const activeProvider = useMemo(() => (user?.auth_provider || 'soundcloud').toLowerCase(), [user?.auth_provider])
  const activeProviderLabel = useMemo(() => getProviderLabel(activeProvider), [activeProvider])

  const providerQuery = useQuery({
    queryKey: queryKeys.providerPlaylistsByProvider(activeProvider),
    queryFn: () =>
      apiJson<ProviderPlaylist[]>(`/api/v1/playlists/providers/${activeProvider}`, { authRequired: true }),
    enabled: !!user?.id && !!activeProvider,
    refetchInterval: 180_000,
    staleTime: 60_000,
  })

  const votunaQuery = useQuery({
    queryKey: queryKeys.votunaPlaylists,
    queryFn: () => apiJson<VotunaPlaylist[]>('/api/v1/votuna/playlists', { authRequired: true }),
    enabled: !!user?.id,
    refetchInterval: 60_000,
    staleTime: 10_000,
  })

  const pendingInvitesQuery = useQuery({
    queryKey: queryKeys.votunaPendingInvites,
    queryFn: () => apiJson<PendingInvite[]>('/api/v1/votuna/invites/pending', { authRequired: true }),
    enabled: !!user?.id,
    refetchInterval: 60_000,
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
          provider: activeProvider,
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
        <SurfaceCard>
          <Text className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading session...</Text>
        </SurfaceCard>
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
        <AppSectionHeader eyebrow="Dashboard" title="Playlist dashboard" />

        <SurfaceCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <SectionEyebrow>New Votuna playlist</SectionEyebrow>
              <Text className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                Create a {activeProviderLabel} playlist and enable voting immediately.
              </Text>
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
              <label className="flex shrink-0 items-center gap-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                <Switch
                  checked={newPlaylistIsPublic}
                  onChange={(checked) => setNewPlaylistIsPublic(checked)}
                  color="emerald"
                />
                <span>{newPlaylistIsPublic ? 'Public' : 'Private'}</span>
              </label>
              <AppButton
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newPlaylistTitle.trim()}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </AppButton>
            </div>
          </div>
          {playlistErrorMessage ? (
            <StatusCallout tone="error" title="Playlist action" className="mt-4">
              {playlistErrorMessage}
            </StatusCallout>
          ) : null}
        </SurfaceCard>

        {shouldShowCollaboratorSection ? (
          <div className="space-y-4">
            <AppSectionHeader title="Collaborator playlists" className="items-center" />
            {isCollaboratorSectionLoading ? (
              <SurfaceCard>
                <Text className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading collaborator playlists...</Text>
              </SurfaceCard>
            ) : (
              <div className="grid gap-4">
                {collaboratorVotunaPlaylists.map((playlist) => {
                  const providerPlaylistUrl = getProviderPlaylistUrl({
                    provider: playlist.provider,
                    providerPlaylistId: playlist.provider_playlist_id,
                    playlistTitle: playlist.title,
                    profilePermalinkUrl: playlist.owner_profile_url,
                  })
                  return (
                    <AppPanelRow key={playlist.id} className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        {providerPlaylistUrl ? (
                          <a
                            href={providerPlaylistUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-lg font-semibold text-[rgb(var(--votuna-ink))] hover:underline"
                          >
                            {playlist.title}
                          </a>
                        ) : (
                          <Text className="text-lg font-semibold text-[rgb(var(--votuna-ink))]">
                            {playlist.title}
                          </Text>
                        )}
                        <Text className="mt-1 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                          Shared via {playlist.provider}
                        </Text>
                      </div>
                      <AppRouteButton href={`/playlists/${playlist.id}`}>Open</AppRouteButton>
                    </AppPanelRow>
                  )
                })}
                {pendingInvites.map((invite) => {
                  const action = pendingInviteActions[invite.invite_id]
                  const isAccepting = action === 'accept'
                  const isDeclining = action === 'decline'
                  return (
                    <AppPanelRow
                      key={invite.invite_id}
                      className="flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <Text className="text-lg font-semibold text-[rgb(var(--votuna-ink))]">{invite.playlist_title}</Text>
                        <Text className="mt-1 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                          Pending invite from {invite.owner_display_name || `User ${invite.owner_user_id}`}
                        </Text>
                        <Text className="mt-1 text-xs text-[color:rgb(var(--votuna-ink)/0.5)]">
                          {invite.expires_at
                            ? `Expires ${new Date(invite.expires_at).toLocaleDateString()}`
                            : 'No expiry'}
                        </Text>
                      </div>
                      <div className="flex items-center gap-3">
                        <AppButton
                          onClick={() => acceptInviteMutation.mutate(invite.invite_id)}
                          disabled={Boolean(action)}
                        >
                          {isAccepting ? 'Accepting...' : 'Accept'}
                        </AppButton>
                        <AppButton
                          intent="secondary"
                          onClick={() => declineInviteMutation.mutate(invite.invite_id)}
                          disabled={Boolean(action)}
                        >
                          {isDeclining ? 'Declining...' : 'Decline'}
                        </AppButton>
                      </div>
                    </AppPanelRow>
                  )
                })}
              </div>
            )}
            {pendingInvitesErrorMessage ? (
              <StatusCallout tone="error" title="Invite action">
                {pendingInvitesErrorMessage}
              </StatusCallout>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-4">
          <AppSectionHeader title="Your playlists" className="items-center" />

          {providerDashboardLoading ? (
            <SurfaceCard>
              <Text className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading playlists...</Text>
            </SurfaceCard>
          ) : providerPlaylists.length === 0 ? (
            <SurfaceCard>
              <Text className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">No playlists found.</Text>
            </SurfaceCard>
          ) : (
            <div className="grid gap-4">
              {providerPlaylists.map((playlist) => {
                const key = `${playlist.provider}:${playlist.provider_playlist_id}`
                const votuna = votunaMap.get(key)
                const providerPlaylistUrl = getProviderPlaylistUrl({
                  provider: playlist.provider,
                  providerPlaylistId: playlist.provider_playlist_id,
                  playlistTitle: playlist.title,
                  profilePermalinkUrl: user.permalink_url,
                  providerPlaylistUrl: playlist.url,
                })
                return (
                  <AppPanelRow
                    key={playlist.provider_playlist_id}
                    className="flex flex-wrap items-center justify-between gap-4"
                  >
                    <div>
                      {providerPlaylistUrl ? (
                        <a
                          href={providerPlaylistUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-lg font-semibold text-[rgb(var(--votuna-ink))] hover:underline"
                        >
                          {playlist.title}
                        </a>
                      ) : (
                        <Text className="text-lg font-semibold text-[rgb(var(--votuna-ink))]">
                          {playlist.title}
                        </Text>
                      )}
                      <Text className="mt-1 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                        {playlist.track_count ?? 0} tracks
                        {playlist.is_public === undefined || playlist.is_public === null
                          ? ''
                          : playlist.is_public
                            ? ' - Public'
                            : ' - Private'}
                      </Text>
                    </div>
                    {votuna ? (
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-[rgba(var(--votuna-accent-soft),0.7)] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-ink))]">
                          Votuna enabled
                        </span>
                        <AppRouteButton href={`/playlists/${votuna.id}`}>Open</AppRouteButton>
                      </div>
                    ) : (
                      <AppButton
                        onClick={() => enableMutation.mutate(playlist)}
                        disabled={enabling[playlist.provider_playlist_id]}
                      >
                        {enabling[playlist.provider_playlist_id] ? 'Enabling...' : 'Enable Votuna'}
                      </AppButton>
                    )}
                  </AppPanelRow>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
