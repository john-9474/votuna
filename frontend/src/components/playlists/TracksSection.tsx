import { RiCloseLine } from '@remixicon/react'
import { Text } from '@tremor/react'
import { useEffect, useMemo, useState } from 'react'

import type { ProviderTrack, TrackPlayRequest } from '@/lib/types/votuna'
import AppPanelRow from '@/components/ui/AppPanelRow'
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

const INITIAL_VISIBLE_TRACKS = 80
const VISIBLE_TRACKS_STEP = 80

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
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_TRACKS)

  useEffect(() => {
    setVisibleCount(Math.min(INITIAL_VISIBLE_TRACKS, tracks.length))
  }, [tracks.length])

  const visibleTracks = useMemo(() => tracks.slice(0, visibleCount), [tracks, visibleCount])
  const remainingCount = Math.max(0, tracks.length - visibleCount)

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
        <div className="mt-4 space-y-3">
          {visibleTracks.map((track) => (
            <AppPanelRow
              key={track.provider_track_id}
              className="flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex w-full flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
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
                      <Text className="truncate text-sm font-semibold text-[rgb(var(--votuna-ink))]">{track.title}</Text>
                    )}
                    <Text className="mt-1 truncate text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                      {track.artist || 'Unknown artist'}
                    </Text>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-3 text-right sm:w-auto sm:justify-end">
                  <div className="min-w-0">
                    <Text className="mt-1 text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
                      {track.added_by_label
                        ? track.added_by_label
                        : track.suggested_by_display_name
                          ? `Suggested by ${track.suggested_by_display_name}`
                          : track.suggested_by_user_id
                            ? 'Suggested by a former member'
                            : 'Added outside Votuna'}
                    </Text>
                    <Text className="text-xs text-[color:rgb(var(--votuna-ink)/0.5)] tabular-nums">
                      {formatAddedDate(track.added_at)}
                    </Text>
                  </div>
                  <div className="flex items-center gap-2">
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
                        className="w-24 justify-center"
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
                </div>
              </div>
            </AppPanelRow>
          ))}
          {remainingCount > 0 ? (
            <div className="flex justify-center pt-2">
              <AppButton
                intent="secondary"
                onClick={() =>
                  setVisibleCount((prev) => Math.min(tracks.length, prev + VISIBLE_TRACKS_STEP))
                }
              >
                Show {Math.min(VISIBLE_TRACKS_STEP, remainingCount)} more
              </AppButton>
            </div>
          ) : null}
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
