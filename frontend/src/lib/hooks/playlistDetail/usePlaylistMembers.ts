import { useMutation, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiFetch, type ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/constants/queryKeys'

type UsePlaylistMembersArgs = {
  playlistId: string | undefined
  currentUserId: number | undefined
  ownerUserId: number | undefined
  canManageMembers: boolean
  queryClient: QueryClient
}

export function usePlaylistMembers({
  playlistId,
  currentUserId,
  ownerUserId,
  canManageMembers,
  queryClient,
}: UsePlaylistMembersArgs) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [removingMemberUserId, setRemovingMemberUserId] = useState<number | null>(null)

  const invalidateMembershipQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.votunaMembers(playlistId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.votunaPlaylist(playlistId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.votunaPlaylists }),
    ])
  }

  const removeMemberMutation = useMutation({
    mutationFn: async (memberUserId: number) => {
      const response = await apiFetch(`/api/v1/votuna/playlists/${playlistId}/members/${memberUserId}`, {
        method: 'DELETE',
        authRequired: true,
      })
      if (response.ok) return memberUserId
      const body = await response.json().catch(() => ({}))
      const message = typeof body.detail === 'string' ? body.detail : 'Unable to remove collaborator'
      const apiError: ApiError = new Error(message)
      apiError.status = response.status
      apiError.detail = message
      throw apiError
    },
    onMutate: (memberUserId) => {
      setStatus('')
      setError('')
      setRemovingMemberUserId(memberUserId)
    },
    onSuccess: async () => {
      setStatus('Collaborator removed.')
      await invalidateMembershipQueries()
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : 'Unable to remove collaborator'
      setError(message)
    },
    onSettled: () => {
      setRemovingMemberUserId(null)
    },
  })

  const leavePlaylistMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(`/api/v1/votuna/playlists/${playlistId}/members/me`, {
        method: 'DELETE',
        authRequired: true,
      })
      if (response.ok) return
      const body = await response.json().catch(() => ({}))
      const message = typeof body.detail === 'string' ? body.detail : 'Unable to leave playlist'
      const apiError: ApiError = new Error(message)
      apiError.status = response.status
      apiError.detail = message
      throw apiError
    },
    onMutate: () => {
      setStatus('')
      setError('')
    },
    onSuccess: async () => {
      setStatus('You left the playlist.')
      await invalidateMembershipQueries()
      if (typeof window !== 'undefined') {
        window.location.assign('/')
      }
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : 'Unable to leave playlist'
      setError(message)
    },
  })

  return {
    currentUserId,
    canManageMembers: Boolean(canManageMembers && ownerUserId && currentUserId === ownerUserId),
    canLeavePlaylist: Boolean(playlistId && ownerUserId && currentUserId && currentUserId !== ownerUserId),
    status,
    error,
    remove: {
      run: (memberUserId: number) => removeMemberMutation.mutate(memberUserId),
      isPending: removeMemberMutation.isPending,
      removingMemberUserId,
    },
    leave: {
      run: () => leavePlaylistMutation.mutate(),
      isPending: leavePlaylistMutation.isPending,
    },
  }
}
