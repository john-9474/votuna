import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { apiFetch, apiJson, type ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/constants/queryKeys'
import type { InviteCandidate, PlaylistInvite } from '@/lib/types/votuna'

const DEFAULT_SEARCH_LIMIT = 10

type UsePlaylistInvitesArgs = {
  playlistId: string | undefined
  canInvite: boolean
  queryClient: QueryClient
}

export function usePlaylistInvites({ playlistId, canInvite, queryClient }: UsePlaylistInvitesArgs) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [searchResults, setSearchResults] = useState<InviteCandidate[]>([])
  const [searchError, setSearchError] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [cancellingInviteId, setCancellingInviteId] = useState<number | null>(null)
  const [generatedLink, setGeneratedLink] = useState('')
  const [linkError, setLinkError] = useState('')

  const invitesQuery = useQuery({
    queryKey: queryKeys.votunaInvites(playlistId),
    queryFn: () =>
      apiJson<PlaylistInvite[]>(`/api/v1/votuna/playlists/${playlistId}/invites`, {
        authRequired: true,
      }),
    enabled: Boolean(playlistId && canInvite),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const searchCandidatesMutation = useMutation({
    mutationFn: async (query: string) => {
      const trimmed = query.trim()
      return apiJson<InviteCandidate[]>(
        `/api/v1/votuna/playlists/${playlistId}/invites/candidates?q=${encodeURIComponent(trimmed)}&limit=${DEFAULT_SEARCH_LIMIT}`,
        {
          authRequired: true,
        },
      )
    },
    onMutate: () => {
      setSearchError('')
      setInviteStatus('')
      setInviteError('')
      setGeneratedLink('')
      setLinkError('')
    },
    onSuccess: (data) => {
      setSearchResults(data)
      setHasSearched(true)
    },
    onError: (error) => {
      const apiError = error as ApiError
      setSearchResults([])
      setHasSearched(true)
      setSearchError(apiError?.detail || apiError?.message || 'Unable to search users')
    },
  })

  const createUserInviteMutation = useMutation({
    mutationFn: async (providerUserId: string) =>
      apiJson<PlaylistInvite>(`/api/v1/votuna/playlists/${playlistId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify({
          kind: 'user',
          target_provider_user_id: providerUserId,
        }),
      }),
    onMutate: () => {
      setInviteError('')
      setInviteStatus('')
      setGeneratedLink('')
      setLinkError('')
    },
    onSuccess: async (invite) => {
      const target = invite.target_username_snapshot || invite.target_provider_user_id || 'User'
      setInviteStatus(`Invite sent to ${target}. They can accept from their dashboard after login.`)
      await queryClient.invalidateQueries({ queryKey: queryKeys.votunaMembers(playlistId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.votunaInvites(playlistId) })
    },
    onError: (error) => {
      const apiError = error as ApiError
      setInviteError(apiError?.detail || apiError?.message || 'Unable to send invite')
    },
  })

  const createLinkInviteMutation = useMutation({
    mutationFn: async () =>
      apiJson<PlaylistInvite>(`/api/v1/votuna/playlists/${playlistId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify({
          kind: 'link',
        }),
      }),
    onMutate: () => {
      setLinkError('')
      setGeneratedLink('')
    },
    onSuccess: (invite) => {
      if (!invite.invite_url) {
        setLinkError('Invite link was created but no URL was returned.')
        return
      }
      setGeneratedLink(invite.invite_url)
      void queryClient.invalidateQueries({ queryKey: queryKeys.votunaInvites(playlistId) })
    },
    onError: (error) => {
      const apiError = error as ApiError
      setLinkError(apiError?.detail || apiError?.message || 'Unable to create invite link')
    },
  })

  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      const response = await apiFetch(
        `/api/v1/votuna/playlists/${playlistId}/invites/${inviteId}`,
        {
          method: 'DELETE',
          authRequired: true,
        },
      )
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const error: ApiError = new Error(body.detail ?? 'Unable to cancel invite')
        error.status = response.status
        error.detail = body.detail
        throw error
      }
      return inviteId
    },
    onMutate: (inviteId) => {
      setInviteError('')
      setInviteStatus('')
      setCancellingInviteId(inviteId)
    },
    onSuccess: async () => {
      setInviteStatus('Invite canceled.')
      await queryClient.invalidateQueries({ queryKey: queryKeys.votunaInvites(playlistId) })
    },
    onError: (error) => {
      const apiError = error as ApiError
      setInviteError(apiError?.detail || apiError?.message || 'Unable to cancel invite')
    },
    onSettled: () => {
      setCancellingInviteId(null)
    },
  })

  const openModal = () => {
    setIsOpen(true)
    setSearchError('')
    setInviteError('')
    setInviteStatus('')
    setGeneratedLink('')
    setLinkError('')
  }

  const closeModal = () => {
    setIsOpen(false)
    setSearchQuery('')
    setSearchResults([])
    setHasSearched(false)
    setSearchError('')
    setInviteError('')
    setInviteStatus('')
    setGeneratedLink('')
    setLinkError('')
  }

  const searchCandidates = () => {
    if (!playlistId || !canInvite) return
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setHasSearched(true)
      setSearchResults([])
      setSearchError('Enter a username to search.')
      return
    }
    searchCandidatesMutation.mutate(trimmed)
  }

  const pendingUserInvites = (invitesQuery.data ?? []).filter((invite) => invite.invite_type === 'user')

  return {
    canInvite,
    pendingUserInvites,
    isPendingInvitesLoading: invitesQuery.isLoading,
    modal: {
      isOpen,
      open: openModal,
      close: closeModal,
    },
    search: {
      query: searchQuery,
      setQuery: setSearchQuery,
      hasSearched,
      results: searchResults,
      error: searchError,
      isLoading: searchCandidatesMutation.isPending,
      run: searchCandidates,
      limit: DEFAULT_SEARCH_LIMIT,
    },
    invite: {
      status: inviteStatus,
      error: inviteError,
      isSending: createUserInviteMutation.isPending,
      isCancelling: cancelInviteMutation.isPending,
      cancellingInviteId,
      sendToCandidate: (candidate: InviteCandidate) =>
        createUserInviteMutation.mutate(candidate.provider_user_id),
      cancelPendingInvite: (inviteId: number) => cancelInviteMutation.mutate(inviteId),
    },
    link: {
      url: generatedLink,
      error: linkError,
      isCreating: createLinkInviteMutation.isPending,
      create: () => createLinkInviteMutation.mutate(),
    },
  }
}
