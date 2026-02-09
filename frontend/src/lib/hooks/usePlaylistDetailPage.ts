import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { queryKeys } from '@/lib/constants/queryKeys'
import { apiJson } from '@/lib/api'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { usePlaylistInteractions } from '@/lib/hooks/playlistDetail/usePlaylistInteractions'
import { usePlaylistManagement } from '@/lib/hooks/playlistDetail/usePlaylistManagement'
import { usePlaylistPlayer } from '@/lib/hooks/playlistDetail/usePlaylistPlayer'
import { usePlaylistInvites } from '@/lib/hooks/playlistDetail/usePlaylistInvites'
import { usePlaylistMembers } from '@/lib/hooks/playlistDetail/usePlaylistMembers'
import { usePlaylistSettings } from '@/lib/hooks/playlistDetail/usePlaylistSettings'
import type {
  PlaylistMember,
  PlaylistType,
  ProviderTrack,
  Suggestion,
  VotunaPlaylist,
} from '@/lib/types/votuna'

type PlaylistDetailTab = 'playlist' | 'manage' | 'settings'

export function usePlaylistDetailPage(
  playlistId: string | undefined,
  activeTab: PlaylistDetailTab = 'playlist',
) {
  const queryClient = useQueryClient()
  const currentUserQuery = useCurrentUser()
  const currentUser = currentUserQuery.data ?? null
  const isPlaylistTabActive = activeTab === 'playlist'
  const isManageTabActive = activeTab === 'manage'
  const isSettingsTabActive = activeTab === 'settings'

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
    enabled: Boolean(playlistId && isPlaylistTabActive),
    refetchInterval: 10_000,
    staleTime: 5_000,
  })

  const tracksQuery = useQuery({
    queryKey: queryKeys.votunaTracks(playlistId),
    queryFn: () =>
      apiJson<ProviderTrack[]>(`/api/v1/votuna/playlists/${playlistId}/tracks`, {
        authRequired: true,
      }),
    enabled: Boolean(playlistId && isPlaylistTabActive),
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.votunaMembers(playlistId),
    queryFn: () =>
      apiJson<PlaylistMember[]>(`/api/v1/votuna/playlists/${playlistId}/members`, {
        authRequired: true,
      }),
    enabled: Boolean(playlistId && (isPlaylistTabActive || isSettingsTabActive)),
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const playlist = playlistQuery.data ?? null
  const settings = playlist?.settings ?? null
  const suggestions = useMemo(
    () => (isPlaylistTabActive ? suggestionsQuery.data ?? [] : []),
    [isPlaylistTabActive, suggestionsQuery.data],
  )
  const tracks = useMemo(
    () => (isPlaylistTabActive ? tracksQuery.data ?? [] : []),
    [isPlaylistTabActive, tracksQuery.data],
  )
  const members = useMemo(
    () => (isPlaylistTabActive || isSettingsTabActive ? membersQuery.data ?? [] : []),
    [isPlaylistTabActive, isSettingsTabActive, membersQuery.data],
  )

  const pendingSuggestionTrackIds = useMemo(
    () => suggestions.map((suggestion) => suggestion.provider_track_id),
    [suggestions],
  )
  const inPlaylistTrackIds = useMemo(
    () => tracks.map((track) => track.provider_track_id),
    [tracks],
  )

  const canEditSettings = useMemo(() => {
    return Boolean(playlist && currentUser?.id && playlist.owner_user_id === currentUser.id)
  }, [playlist, currentUser])

  const collaboratorCount = useMemo(() => {
    if (!playlist) return 0
    return members.filter((member) => member.user_id !== playlist.owner_user_id).length
  }, [members, playlist])

  const hasLoadedMembers = membersQuery.data !== undefined
  const isCollaborative = !hasLoadedMembers || collaboratorCount > 0
  const playlistType: PlaylistType = isCollaborative ? 'collaborative' : 'personal'

  const memberNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const member of membersQuery.data ?? []) {
      if (member.display_name) {
        map.set(member.user_id, member.display_name)
      }
    }
    if (currentUser?.id) {
      map.set(currentUser.id, 'You')
    }
    return map
  }, [membersQuery.data, currentUser])

  const settingsState = usePlaylistSettings({
    playlistId,
    settings,
    canEditSettings,
    isCollaborative,
    queryClient,
  })

  const interactionState = usePlaylistInteractions({
    playlistId,
    queryClient,
    isCollaborative,
  })

  const playerState = usePlaylistPlayer()

  const managementState = usePlaylistManagement({
    playlistId,
    playlist,
    canManage: canEditSettings && isManageTabActive,
    currentUserId: currentUser?.id,
    queryClient,
  })

  const inviteState = usePlaylistInvites({
    playlistId,
    canInvite: canEditSettings && isSettingsTabActive,
    queryClient,
  })

  const memberActionsState = usePlaylistMembers({
    playlistId,
    currentUserId: currentUser?.id,
    ownerUserId: playlist?.owner_user_id,
    canManageMembers: canEditSettings,
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
    collaboratorCount,
    isCollaborative,
    playlistType,
    memberNameById,
    pendingSuggestionTrackIds,
    inPlaylistTrackIds,
    ...settingsState,
    ...interactionState,
    ...playerState,
    invites: inviteState,
    memberActions: memberActionsState,
    management: managementState,
  }
}
