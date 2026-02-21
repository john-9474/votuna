import { RiCloseLine } from '@remixicon/react'
import { type ColumnDef } from '@tanstack/react-table'
import { Text } from '@tremor/react'
import { useMemo } from 'react'

import type { ProviderTrack, TrackPlayRequest } from '@/lib/types/votuna'
import AppDataTable, { type AppDataTableColumnMeta } from '@/components/ui/AppDataTable'
import AppSectionHeader from '@/components/ui/AppSectionHeader'
import AppButton from '@/components/ui/AppButton'
import StatusCallout from '@/components/ui/StatusCallout'
import SurfaceCard from '@/components/ui/SurfaceCard'

import TrackArtwork from './TrackArtwork'

type TracksSectionProps = {
  provider: string
  tracks: ProviderTrack[]
  isLoading: boolean
  onPlayTrack: (track: TrackPlayRequest) => void
  canRemoveTracks: boolean
  onRemoveTrack: (providerTrackId: string) => void
  isRemoveTrackPending: boolean
  removingTrackId: string | null
  statusMessage?: string
}

const getProviderLabel = (provider: string) => {
  const normalized = provider.trim().toLowerCase()
  if (normalized === 'spotify') return 'Spotify'
  if (normalized === 'soundcloud') return 'SoundCloud'
  if (normalized === 'apple') return 'Apple Music'
  if (normalized === 'tidal') return 'TIDAL'
  return 'provider'
}

const formatAddedDate = (addedAt: string | null | undefined) => {
  if (!addedAt) return 'Added date unavailable'
  const date = new Date(addedAt)
  if (Number.isNaN(date.getTime())) return 'Added date unavailable'
  return `Added ${date.toLocaleDateString()}`
}

const getAddedByLabel = (track: ProviderTrack) => {
  if (track.added_by_label) return track.added_by_label
  if (track.suggested_by_display_name) return `Suggested by ${track.suggested_by_display_name}`
  if (track.suggested_by_user_id) return 'Suggested by a former member'
  return 'Added outside Votuna'
}

export default function TracksSection({
  provider,
  tracks,
  isLoading,
  onPlayTrack,
  canRemoveTracks,
  onRemoveTrack,
  isRemoveTrackPending,
  removingTrackId,
  statusMessage,
}: TracksSectionProps) {
  const providerLabel = getProviderLabel(provider)
  const columns = useMemo<Array<ColumnDef<ProviderTrack, unknown>>>(
    () => [
      {
        id: 'song',
        header: 'Song',
        accessorFn: (track) => track.title,
        cell: ({ row }) => {
          const track = row.original
          return (
            <div className="flex min-w-0 items-center gap-3">
              <TrackArtwork artworkUrl={track.artwork_url} title={track.title} />
              <div className="min-w-0">
                {track.url ? (
                  <a
                    href={track.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-semibold text-[rgb(var(--votuna-ink))] hover:underline"
                  >
                    {track.title}
                  </a>
                ) : (
                  <Text className="truncate text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                    {track.title}
                  </Text>
                )}
                <Text className="mt-1 truncate text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                  {track.artist || 'Unknown artist'}
                </Text>
              </div>
            </div>
          )
        },
      },
      {
        id: 'addedBy',
        header: 'Added by',
        accessorFn: (track) => getAddedByLabel(track),
        cell: ({ row }) => (
          <Text className="text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
            {getAddedByLabel(row.original)}
          </Text>
        ),
        meta: { cellClassName: 'align-top' } satisfies AppDataTableColumnMeta,
      },
      {
        id: 'addedOn',
        header: 'Added on',
        accessorFn: (track) => {
          if (!track.added_at) return 0
          const timestamp = new Date(track.added_at).getTime()
          return Number.isNaN(timestamp) ? 0 : timestamp
        },
        cell: ({ row }) => (
          <Text className="text-xs text-[color:rgb(var(--votuna-ink)/0.5)] tabular-nums">
            {formatAddedDate(row.original.added_at)}
          </Text>
        ),
        meta: { cellClassName: 'align-top' } satisfies AppDataTableColumnMeta,
      },
      {
        id: 'actions',
        header: 'Actions',
        accessorFn: () => '',
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => {
          const track = row.original
          return (
            <div className="flex items-center justify-end gap-2">
              {track.url ? (
                <AppButton
                  intent="secondary"
                  onClick={() =>
                    onPlayTrack({
                      key: `track-${track.provider_track_id}`,
                      title: track.title,
                      artist: track.artist,
                      url: track.url,
                      artworkUrl: track.artwork_url,
                    })
                  }
                  className="w-20 justify-center"
                >
                  Play
                </AppButton>
              ) : null}
              {canRemoveTracks ? (
                <AppButton
                  intent="icon"
                  aria-label={`Remove ${track.title}`}
                  disabled={isRemoveTrackPending}
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      const confirmed = window.confirm(`Remove "${track.title}" from this playlist?`)
                      if (!confirmed) return
                    }
                    onRemoveTrack(track.provider_track_id)
                  }}
                >
                  {isRemoveTrackPending && removingTrackId === track.provider_track_id ? (
                    '...'
                  ) : (
                    <RiCloseLine className="h-4 w-4" />
                  )}
                </AppButton>
              ) : null}
            </div>
          )
        },
        meta: {
          headerClassName: 'text-right',
          cellClassName: 'align-top',
        } satisfies AppDataTableColumnMeta,
      },
    ],
    [
      canRemoveTracks,
      isRemoveTrackPending,
      onPlayTrack,
      onRemoveTrack,
      removingTrackId,
    ],
  )

  return (
    <SurfaceCard>
      <AppSectionHeader
        eyebrow="Current playlist songs"
        description={`Tracks currently in the ${providerLabel} playlist.`}
      />

      {isLoading ? (
        <Text className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading tracks...</Text>
      ) : tracks.length === 0 ? (
        <Text className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">No tracks found.</Text>
      ) : (
        <div className="mt-4">
          <AppDataTable
            data={tracks}
            columns={columns}
            itemLabel="tracks"
            searchPlaceholder="Search current playlist songs"
            emptyMessage="No tracks match your search."
            tableAriaLabel="Current playlist tracks"
            globalFilterFn={(track, normalizedFilter) => {
              if (!normalizedFilter) return true
              const haystack = [
                track.title,
                track.artist,
                track.genre,
                track.provider_track_id,
                track.added_by_label,
                track.suggested_by_display_name,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
              return haystack.includes(normalizedFilter)
            }}
          />
        </div>
      )}
      {statusMessage ? (
        <StatusCallout tone="error" title="Track action" className="mt-3">
          {statusMessage}
        </StatusCallout>
      ) : null}
    </SurfaceCard>
  )
}
