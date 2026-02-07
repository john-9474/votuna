import { useMutation, type QueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { apiJson, type ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/constants/queryKeys'
import type {
  ManagementDirection,
  ManagementExecuteResponse,
  ManagementPlaylistRef,
  ManagementPreviewResponse,
  ManagementSelectionMode,
  ManagementTransferRequest,
} from '@/lib/types/votuna'

import { uniqueTrimmedValues } from './shared'

type UseManagementTransferArgs = {
  playlistId: string | undefined
  queryClient: QueryClient
  direction: ManagementDirection
  exportTargetMode: 'existing' | 'create'
  selectedCounterpartyRef: ManagementPlaylistRef | null
  destinationCreateTitle: string
  destinationCreateDescription: string
  destinationCreateIsPublic: boolean
  selectionMode: ManagementSelectionMode
  selectionValuesInput: string
  selectedSongIds: string[]
}

export function useManagementTransfer({
  playlistId,
  queryClient,
  direction,
  exportTargetMode,
  selectedCounterpartyRef,
  destinationCreateTitle,
  destinationCreateDescription,
  destinationCreateIsPublic,
  selectionMode,
  selectionValuesInput,
  selectedSongIds,
}: UseManagementTransferArgs) {
  const [preview, setPreview] = useState<ManagementPreviewResponse | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [executeResult, setExecuteResult] = useState<ManagementExecuteResponse | null>(null)
  const [executeError, setExecuteError] = useState('')

  const parsedSelectionValues = useMemo(() => {
    if (selectionMode === 'all') return []
    if (selectionMode === 'songs') return selectedSongIds
    return uniqueTrimmedValues(selectionValuesInput)
  }, [selectionMode, selectedSongIds, selectionValuesInput])

  const managementRequest = useMemo<ManagementTransferRequest | null>(() => {
    const selectionValid = selectionMode === 'all' || parsedSelectionValues.length > 0
    if (!selectionValid) return null

    if (direction === 'import_to_current') {
      if (!selectedCounterpartyRef) return null
      return {
        direction,
        counterparty: selectedCounterpartyRef,
        destination_create: null,
        selection_mode: selectionMode,
        selection_values: parsedSelectionValues,
      }
    }

    if (exportTargetMode === 'create') {
      const title = destinationCreateTitle.trim()
      if (!title) return null
      return {
        direction,
        counterparty: null,
        destination_create: {
          title,
          description: destinationCreateDescription.trim() || null,
          is_public: destinationCreateIsPublic,
        },
        selection_mode: selectionMode,
        selection_values: parsedSelectionValues,
      }
    }

    if (!selectedCounterpartyRef) return null
    return {
      direction,
      counterparty: selectedCounterpartyRef,
      destination_create: null,
      selection_mode: selectionMode,
      selection_values: parsedSelectionValues,
    }
  }, [
    direction,
    exportTargetMode,
    selectedCounterpartyRef,
    destinationCreateTitle,
    destinationCreateDescription,
    destinationCreateIsPublic,
    selectionMode,
    parsedSelectionValues,
  ])

  const managementRequestKey = JSON.stringify(managementRequest)

  useEffect(() => {
    setPreview(null)
    setPreviewError('')
    setExecuteResult(null)
    setExecuteError('')
  }, [managementRequestKey])

  const previewMutation = useMutation({
    mutationFn: async (payload: ManagementTransferRequest) =>
      apiJson<ManagementPreviewResponse>(`/api/v1/votuna/playlists/${playlistId}/management/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify(payload),
      }),
    onMutate: () => {
      setPreviewError('')
    },
    onSuccess: (data) => {
      setPreview(data)
      setExecuteResult(null)
      setExecuteError('')
    },
    onError: (error) => {
      const apiError = error as ApiError
      setPreview(null)
      setPreviewError(apiError?.detail || apiError?.message || 'Unable to preview transfer')
    },
  })

  const executeMutation = useMutation({
    mutationFn: async (payload: ManagementTransferRequest) =>
      apiJson<ManagementExecuteResponse>(`/api/v1/votuna/playlists/${playlistId}/management/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify(payload),
      }),
    onMutate: () => {
      setExecuteError('')
    },
    onSuccess: async (data, variables) => {
      setExecuteResult(data)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.votunaTracks(playlistId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.providerPlaylistsRoot }),
      ])
      if (variables.counterparty?.kind === 'votuna') {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.votunaTracks(String(variables.counterparty.votuna_playlist_id)),
        })
      }
    },
    onError: (error) => {
      const apiError = error as ApiError
      setExecuteError(apiError?.detail || apiError?.message || 'Unable to execute transfer')
    },
  })

  return {
    canPreview: Boolean(managementRequest),
    isPreviewPending: previewMutation.isPending,
    preview,
    previewError,
    onPreview: () => {
      if (!playlistId || !managementRequest) return
      previewMutation.mutate(managementRequest)
    },
    canExecute: Boolean(managementRequest && preview),
    isExecutePending: executeMutation.isPending,
    executeResult,
    executeError,
    onExecute: () => {
      if (!playlistId || !managementRequest) return
      executeMutation.mutate(managementRequest)
    },
  }
}
