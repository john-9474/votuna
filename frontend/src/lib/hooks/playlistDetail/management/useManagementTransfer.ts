import { useMutation, type QueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

import { apiJson, type ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/constants/queryKeys'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import type {
  ManagementDirection,
  ManagementExecuteResponse,
  ManagementPlaylistRef,
  ManagementPreviewResponse,
  ManagementSelectionMode,
  ManagementTransferRequest,
} from '@/lib/types/votuna'

import { uniqueTrimmedValues } from './shared'

const PREVIEW_DEBOUNCE_MS = 400

const requestKeyForPayload = (payload: ManagementTransferRequest | null) =>
  payload ? JSON.stringify(payload) : ''

export type ManagementReviewStatus = 'idle' | 'loading' | 'ready' | 'error'

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
  selectionValues: string[]
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
  selectionValues,
}: UseManagementTransferArgs) {
  const [preview, setPreview] = useState<ManagementPreviewResponse | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [previewRequestKey, setPreviewRequestKey] = useState('')
  const [executeResult, setExecuteResult] = useState<ManagementExecuteResponse | null>(null)
  const [executeError, setExecuteError] = useState('')

  const parsedSelectionValues = useMemo(
    () => uniqueTrimmedValues(selectionValues),
    [selectionValues],
  )

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

  const managementRequestKey = requestKeyForPayload(managementRequest)
  const debouncedManagementRequest = useDebouncedValue(managementRequest, PREVIEW_DEBOUNCE_MS)
  const debouncedManagementRequestKey = requestKeyForPayload(debouncedManagementRequest)
  const latestRequestKeyRef = useRef(managementRequestKey)

  useEffect(() => {
    latestRequestKeyRef.current = managementRequestKey
  }, [managementRequestKey])

  useEffect(() => {
    setExecuteResult(null)
    setExecuteError('')
  }, [managementRequestKey])

  useEffect(() => {
    if (managementRequest) return
    setPreview(null)
    setPreviewError('')
    setPreviewRequestKey('')
  }, [managementRequest])

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
    onSuccess: (data, variables) => {
      const responseRequestKey = requestKeyForPayload(variables)
      if (responseRequestKey !== latestRequestKeyRef.current) return
      setPreview(data)
      setPreviewRequestKey(responseRequestKey)
      setExecuteResult(null)
      setExecuteError('')
    },
    onError: (error, variables) => {
      const responseRequestKey = requestKeyForPayload(variables)
      if (responseRequestKey !== latestRequestKeyRef.current) return
      const apiError = error as ApiError
      setPreview(null)
      setPreviewRequestKey('')
      setPreviewError(apiError?.detail || apiError?.message || 'Unable to preview transfer')
    },
  })
  const runPreview = previewMutation.mutate

  useEffect(() => {
    if (!playlistId || !debouncedManagementRequest) return

    const debouncedRequestKey = requestKeyForPayload(debouncedManagementRequest)
    if (debouncedRequestKey !== latestRequestKeyRef.current) return
    if (previewRequestKey === debouncedRequestKey && preview) return

    runPreview(debouncedManagementRequest)
  }, [
    playlistId,
    debouncedManagementRequest,
    previewRequestKey,
    preview,
    runPreview,
  ])

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

  const isReviewRequestValid = Boolean(managementRequest)
  const isDebouncePending = Boolean(
    managementRequest && managementRequestKey !== debouncedManagementRequestKey,
  )
  const isReviewLoading = Boolean(isReviewRequestValid && (isDebouncePending || previewMutation.isPending))
  const isReviewFresh = Boolean(
    preview && previewRequestKey && managementRequestKey === previewRequestKey,
  )

  let reviewStatus: ManagementReviewStatus = 'idle'
  if (!isReviewRequestValid) {
    reviewStatus = 'idle'
  } else if (isReviewLoading) {
    reviewStatus = 'loading'
  } else if (previewError) {
    reviewStatus = 'error'
  } else if (isReviewFresh) {
    reviewStatus = 'ready'
  }

  return {
    canReview: isReviewRequestValid,
    reviewStatus,
    isReviewLoading,
    isReviewFresh,
    preview,
    previewError,
    canExecute: Boolean(managementRequest && isReviewFresh && reviewStatus === 'ready'),
    isExecutePending: executeMutation.isPending,
    executeResult,
    executeError,
    onExecute: () => {
      if (!playlistId || !managementRequest || !isReviewFresh) return
      executeMutation.mutate(managementRequest)
    },
  }
}
