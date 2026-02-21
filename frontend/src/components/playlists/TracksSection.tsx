import { RiCloseLine } from '@remixicon/react'
import { Text } from '@tremor/react'
import { useEffect, useMemo, useState } from 'react'

import type { ProviderTrack, TrackPlayRequest } from '@/lib/types/votuna'
import AppSectionHeader from '@/components/ui/AppSectionHeader'
import AppButton from '@/components/ui/AppButton'
import ClearableTextInput from '@/components/ui/ClearableTextInput'
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

const TRACKS_PAGE_SIZE = 25

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
  const [searchInput, setSearchInput] = useState('')
  const [pageIndex, setPageIndex] = useState(0)

  const normalizedSearch = searchInput.trim().toLowerCase()
  const filteredTracks = useMemo(() => {
    if (!normalizedSearch) return tracks
    return tracks.filter((track) => {
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
      return haystack.includes(normalizedSearch)
    })
  }, [tracks, normalizedSearch])

  const pageCount = Math.max(1, Math.ceil(filteredTracks.length / TRACKS_PAGE_SIZE))
  const canPageBack = pageIndex > 0
  const canPageForward = pageIndex + 1 < pageCount
  const pageStart = pageIndex * TRACKS_PAGE_SIZE
  const visibleTracks = useMemo(
    () => filteredTracks.slice(pageStart, pageStart + TRACKS_PAGE_SIZE),
    [filteredTracks, pageStart],
  )
  const rangeStart = filteredTracks.length === 0 ? 0 : pageStart + 1
  const rangeEnd =
    filteredTracks.length === 0 ? 0 : Math.min(pageStart + TRACKS_PAGE_SIZE, filteredTracks.length)

  useEffect(() => {
    setPageIndex(0)
  }, [normalizedSearch])

  useEffect(() => {
    if (pageIndex < pageCount) return
    setPageIndex(Math.max(0, pageCount - 1))
  }, [pageCount, pageIndex])

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
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full max-w-sm">
              <ClearableTextInput
                value={searchInput}
                onValueChange={setSearchInput}
                placeholder="Search current playlist songs"
                clearAriaLabel="Clear current playlist search"
              />
            </div>
            <Text className="text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
              {filteredTracks.length === tracks.length
                ? `${tracks.length} total tracks`
                : `${filteredTracks.length} matching tracks`}
            </Text>
          </div>

          {filteredTracks.length === 0 ? (
            <Text className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">No tracks match your search.</Text>
          ) : (
            <>
              <div className="overflow-x-auto rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)]">
                <table className="min-w-full divide-y divide-[color:rgb(var(--votuna-ink)/0.1)]">
                  <thead className="bg-[rgba(var(--votuna-paper),0.75)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:rgb(var(--votuna-ink)/0.58)]">
                        Song
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:rgb(var(--votuna-ink)/0.58)]">
                        Added by
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:rgb(var(--votuna-ink)/0.58)]">
                        Added on
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[color:rgb(var(--votuna-ink)/0.58)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:rgb(var(--votuna-ink)/0.08)]">
                    {visibleTracks.map((track) => (
                      <tr key={track.provider_track_id}>
                        <td className="px-4 py-3">
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
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Text className="text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                            {getAddedByLabel(track)}
                          </Text>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Text className="text-xs text-[color:rgb(var(--votuna-ink)/0.5)] tabular-nums">
                            {formatAddedDate(track.added_at)}
                          </Text>
                        </td>
                        <td className="px-4 py-3 align-top">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Text className="text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
                  Showing {rangeStart}-{rangeEnd} of {filteredTracks.length}
                </Text>
                <div className="flex items-center gap-2">
                  <AppButton
                    intent="ghost"
                    disabled={!canPageBack}
                    onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                  >
                    Previous
                  </AppButton>
                  <AppButton
                    intent="ghost"
                    disabled={!canPageForward}
                    onClick={() => setPageIndex((prev) => prev + 1)}
                  >
                    Next
                  </AppButton>
                </div>
              </div>
            </>
          )}
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
