import { useEffect, useMemo, useState } from 'react'

import PrimaryButton from '@/components/ui/PrimaryButton'
import type { PlaylistManagementState } from '@/lib/hooks/playlistDetail/usePlaylistManagement'

const REVIEW_TRACKS_PAGE_SIZE = 12

type ReviewRunPanelProps = {
  sourceLabel: string
  destinationLabel: string
  review: PlaylistManagementState['review']
}

export default function ReviewRunPanel({
  sourceLabel,
  destinationLabel,
  review,
}: ReviewRunPanelProps) {
  const [trackPage, setTrackPage] = useState(0)

  const matchedTracks = review.data?.matched_sample ?? []
  const duplicateTrackIdSet = useMemo(
    () => new Set((review.data?.duplicate_sample ?? []).map((track) => track.provider_track_id)),
    [review.data?.duplicate_sample],
  )
  const totalTrackPages = Math.max(1, Math.ceil(matchedTracks.length / REVIEW_TRACKS_PAGE_SIZE))
  const activeTrackPage = Math.min(trackPage, totalTrackPages - 1)
  const trackStartIndex = activeTrackPage * REVIEW_TRACKS_PAGE_SIZE
  const pagedTracks = matchedTracks.slice(
    trackStartIndex,
    trackStartIndex + REVIEW_TRACKS_PAGE_SIZE,
  )
  const pageRangeStart = matchedTracks.length === 0 ? 0 : trackStartIndex + 1
  const pageRangeEnd = Math.min(trackStartIndex + REVIEW_TRACKS_PAGE_SIZE, matchedTracks.length)
  const canGoPrev = activeTrackPage > 0
  const canGoNext = activeTrackPage + 1 < totalTrackPages

  useEffect(() => {
    setTrackPage(0)
  }, [review.data])

  useEffect(() => {
    if (trackPage <= totalTrackPages - 1) return
    setTrackPage(Math.max(totalTrackPages - 1, 0))
  }, [trackPage, totalTrackPages])

  return (
    <div className="rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.82)] p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
        Review and copy
      </p>
      <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
        {sourceLabel} {'->'} {destinationLabel}
      </p>

      <div className="mt-4">
        <PrimaryButton
          onClick={review.run}
          disabled={!review.canRun || review.isRunning}
          className="w-full justify-center"
        >
          {review.isRunning ? 'Copying...' : 'Copy songs'}
        </PrimaryButton>
      </div>

      {review.isUpdating ? (
        <p className="mt-3 text-sm text-[color:rgb(var(--votuna-ink)/0.65)]">Updating review...</p>
      ) : null}

      {review.error ? (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          <p>{review.error}</p>
          {review.error.includes('500') ? (
            <p className="mt-1">Narrow your selection to 500 songs or fewer.</p>
          ) : null}
        </div>
      ) : null}

      {!review.error && review.status === 'idle' && review.idleMessage ? (
        <p className="mt-3 text-sm text-[color:rgb(var(--votuna-ink)/0.62)]">{review.idleMessage}</p>
      ) : null}

      {!review.isFresh && review.data ? (
        <p className="mt-3 text-xs text-[color:rgb(var(--votuna-ink)/0.58)]">
          Choices changed. Updating review before copy.
        </p>
      ) : null}

      {review.data ? (
        <div className="mt-4 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.9)] p-4">
          <div className="grid gap-2 text-xs text-[color:rgb(var(--votuna-ink)/0.65)] sm:grid-cols-3">
            <p>Songs found: {review.data.matched_count}</p>
            <p>Songs to copy: {review.data.to_add_count}</p>
            <p>Already in destination: {review.data.duplicate_count}</p>
          </div>
          <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.56)]">
            Max songs per action: {review.data.max_tracks_per_action}
          </p>
          {review.data.matched_sample.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)]">
              <div className="max-h-72 overflow-auto">
                <table className="w-full table-fixed border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr className="text-left text-[color:rgb(var(--votuna-ink)/0.55)]">
                      <th className="sticky top-0 z-10 bg-[rgb(var(--votuna-paper))] px-3 py-2 font-semibold">
                        Song
                      </th>
                      <th className="sticky top-0 z-10 bg-[rgb(var(--votuna-paper))] px-3 py-2 font-semibold">
                        Artist
                      </th>
                      <th className="sticky top-0 z-10 bg-[rgb(var(--votuna-paper))] px-3 py-2 font-semibold">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTracks.map((track) => {
                      const isDuplicate = duplicateTrackIdSet.has(track.provider_track_id)
                      return (
                        <tr
                          key={`matched-${track.provider_track_id}`}
                          className="border-t border-[color:rgb(var(--votuna-ink)/0.06)] text-[color:rgb(var(--votuna-ink)/0.7)]"
                        >
                          <td className="truncate px-3 py-2" title={track.title}>
                            {track.title}
                          </td>
                          <td className="truncate px-3 py-2" title={track.artist || 'Unknown artist'}>
                            {track.artist || 'Unknown artist'}
                          </td>
                          <td className="px-3 py-2">
                            {isDuplicate ? (
                              <span className="rounded-full bg-[rgba(var(--votuna-ink),0.08)] px-2 py-0.5 text-[10px] font-semibold text-[color:rgb(var(--votuna-ink)/0.72)]">
                                Duplicate
                              </span>
                            ) : (
                              <span className="rounded-full bg-[rgba(var(--votuna-accent-soft),0.65)] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--votuna-ink))]">
                                Will copy
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[color:rgb(var(--votuna-ink)/0.08)] px-3 py-2 text-[11px] text-[color:rgb(var(--votuna-ink)/0.58)]">
                <p>
                  Showing {pageRangeStart}-{pageRangeEnd} of {matchedTracks.length}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!canGoPrev}
                    onClick={() => setTrackPage((prev) => Math.max(prev - 1, 0))}
                    className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.14)] px-3 py-1 text-[11px] disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!canGoNext}
                    onClick={() => setTrackPage((prev) => prev + 1)}
                    className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.14)] px-3 py-1 text-[11px] disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {review.runError ? <p className="mt-3 text-xs text-rose-500">{review.runError}</p> : null}

      {review.runResult ? (
        <div className="mt-4 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.9)] p-4">
          <p className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">Copy result</p>
          <div className="mt-2 grid gap-2 text-xs text-[color:rgb(var(--votuna-ink)/0.65)] sm:grid-cols-2">
            <p>Songs found: {review.runResult.matched_count}</p>
            <p>Copied: {review.runResult.added_count}</p>
            <p>Already in destination: {review.runResult.skipped_duplicate_count}</p>
            <p>Could not copy: {review.runResult.failed_count}</p>
          </div>
          {review.runResult.failed_items.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-rose-500">
              {review.runResult.failed_items.map((item, index) => (
                <li key={`failed-${item.provider_track_id}`}>
                  Song {index + 1}: {item.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
