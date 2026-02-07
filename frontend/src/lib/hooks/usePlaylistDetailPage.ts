import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { queryKeys } from '@/lib/constants/queryKeys'
import { apiJson } from '@/lib/api'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { usePlaylistInteractions } from '@/lib/hooks/playlistDetail/usePlaylistInteractions'
import { usePlaylistManagement } from '@/lib/hooks/playlistDetail/usePlaylistManagement'
import { usePlaylistPlayer } from '@/lib/hooks/playlistDetail/usePlaylistPlayer'
import { usePlaylistInvites } from '@/lib/hooks/playlistDetail/usePlaylistInvites'
import { usePlaylistSettings } from '@/lib/hooks/playlistDetail/usePlaylistSettings'
import type { PlaylistMember, ProviderTrack, Suggestion, VotunaPlaylist } from '@/lib/types/votuna'

export function usePlaylistDetailPage(playlistId: string | undefined) {
  const queryClient = useQueryClient()
  const currentUserQuery = useCurrentUser()
  const currentUser = currentUserQuery.data ?? null

  const playlistQuery = useQuery({
    queryKey: queryKeys.votunaPlaylist(playlistId),
    queryFn: () =>
      apiJson<VotunaPlaylist>(`/api/v1/votuna/playlists/${playlistId}`, { authRequired: true }),
    enabled: !!playlistId,
    refetchInterval: 60_000,
    staleTime: 10_000,
  })

  const suggestionsQuery = useQuery({
    queryKey: queryKeys.votunaSuggestions(playlistId),
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
    queryKey: queryKeys.votunaTracks(playlistId),
    queryFn: () =>
      apiJson<ProviderTrack[]>(`/api/v1/votuna/playlists/${playlistId}/tracks`, {
        authRequired: true,
      }),
    enabled: !!playlistId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.votunaMembers(playlistId),
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

  const settingsState = usePlaylistSettings({
    playlistId,
    settings,
    canEditSettings,
    queryClient,
  })

  const interactionState = usePlaylistInteractions({
    playlistId,
    queryClient,
  })

  const playerState = usePlaylistPlayer()

  const managementState = usePlaylistManagement({
    playlistId,
    playlist,
    canManage: canEditSettings,
    currentUserId: currentUser?.id,
    queryClient,
  })

  const inviteState = usePlaylistInvites({
    playlistId,
    canInvite: canEditSettings,
    queryClient,
  })

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
    ...settingsState,
    ...interactionState,
    ...playerState,
    invites: inviteState,
    management: managementState,
  }
}
