import { Button } from '@tremor/react'
import { RiCloseLine } from '@remixicon/react'

import type { ProviderTrack, TrackPlayRequest } from '@/lib/types/votuna'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'

import TrackArtwork from './TrackArtwork'

type TracksSectionProps = {
  tracks: ProviderTrack[]
  isLoading: boolean
  onPlayTrack: (track: TrackPlayRequest) => void
  canRemoveTracks: boolean
  onRemoveTrack: (providerTrackId: string) => void
  isRemoveTrackPending: boolean
  removingTrackId: string | null
  statusMessage?: string
}

const formatAddedDate = (addedAt: string | null | undefined) => {
  if (!addedAt) return 'Added date unavailable'
  const date = new Date(addedAt)
  if (Number.isNaN(date.getTime())) return 'Added date unavailable'
  return `Added ${date.toLocaleDateString()}`
}

const destructiveActionButtonClass =
  'inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60'

export default function TracksSection({
  tracks,
  isLoading,
  onPlayTrack,
  canRemoveTracks,
  onRemoveTrack,
  isRemoveTrackPending,
  removingTrackId,
  statusMessage,
}: TracksSectionProps) {
  return (
    <SurfaceCard>
      <div className="flex items-center justify-between">
        <div>
          <SectionEyebrow>Current playlist songs</SectionEyebrow>
          <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
            Tracks currently in the SoundCloud playlist.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading tracks...</p>
      ) : tracks.length === 0 ? (
        <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">No tracks found.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {tracks.map((track) => (
            <div
              key={track.provider_track_id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.8)] px-4 py-3"
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
                      <p className="truncate text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                        {track.title}
                      </p>
                    )}
                    <p className="mt-1 truncate text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                      {track.artist || 'Unknown artist'}
                    </p>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-3 text-right sm:w-auto sm:justify-end">
                  <div className="min-w-0">
                    <p className="mt-1 text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
                      {track.added_by_label
                        ? track.added_by_label
                        : track.suggested_by_display_name
                          ? `Suggested by ${track.suggested_by_display_name}`
                          : track.suggested_by_user_id
                            ? 'Suggested by a former member'
                            : 'Added outside Votuna'}
                    </p>
                    <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.5)] tabular-nums">
                      {formatAddedDate(track.added_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {track.url ? (
                      <Button
                        onClick={() =>
                          onPlayTrack({
                            key: `track-${track.provider_track_id}`,
                            title: track.title,
                            artist: track.artist,
                            url: track.url,
                            artworkUrl: track.artwork_url,
                          })
                        }
                        variant="secondary"
                        className="w-24 justify-center rounded-full"
                      >
                        Play
                      </Button>
                    ) : null}
                    {track.url ? (
                      <a
                        href={track.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-24 justify-center rounded-full bg-[rgb(var(--votuna-ink))] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
                      >
                        Open
                      </a>
                    ) : null}
                    {canRemoveTracks ? (
                      <button
                        type="button"
                        aria-label={`Remove ${track.title}`}
                        disabled={isRemoveTrackPending}
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            const confirmed = window.confirm(
                              `Remove "${track.title}" from this playlist?`,
                            )
                            if (!confirmed) return
                          }
                          onRemoveTrack(track.provider_track_id)
                        }}
                        className={destructiveActionButtonClass}
                      >
                        {isRemoveTrackPending && removingTrackId === track.provider_track_id ? (
                          '...'
                        ) : (
                          <RiCloseLine className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {statusMessage ? <p className="mt-3 text-xs text-rose-500">{statusMessage}</p> : null}
    </SurfaceCard>
  )
}
