import { Card, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@tremor/react'
import { useEffect, useMemo, useState } from 'react'

import AppButton from '@/components/ui/AppButton'
import StatusCallout from '@/components/ui/StatusCallout'
import type { PlaylistManagementState } from '@/lib/hooks/playlistDetail/usePlaylistManagement'

const REVIEW_TRACKS_PAGE_SIZE = 10

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
    <Card className="p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
        Review and copy
      </p>
      <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
        {sourceLabel} {'->'} {destinationLabel}
      </p>

      <div className="mt-4">
        <AppButton
          onClick={review.run}
          disabled={!review.canRun || review.isRunning}
          className="w-full justify-center"
        >
          {review.isRunning ? 'Copying...' : 'Copy songs'}
        </AppButton>
      </div>

      {review.isUpdating ? (
        <StatusCallout tone="info" title="Updating" className="mt-3">
          Updating review...
        </StatusCallout>
      ) : null}

      {review.error ? (
        <StatusCallout tone="error" title="Review failed" className="mt-3">
          {review.error}
          {review.error.includes('500') ? ' Narrow your selection to 500 songs or fewer.' : ''}
        </StatusCallout>
      ) : null}

      {!review.error && review.status === 'idle' && review.idleMessage ? (
        <StatusCallout tone="info" title="Review status" className="mt-3">
          {review.idleMessage}
        </StatusCallout>
      ) : null}

      {!review.isFresh && review.data ? (
        <StatusCallout tone="warning" title="Refresh needed" className="mt-3">
          Choices changed. Updating review before copy.
        </StatusCallout>
      ) : null}

      {review.data ? (
        <Card className="mt-4 p-4">
          <div className="grid gap-2 text-xs text-[color:rgb(var(--votuna-ink)/0.65)] sm:grid-cols-3">
            <p>Songs found: {review.data.matched_count}</p>
            <p>Songs to copy: {review.data.to_add_count}</p>
            <p>Already in destination: {review.data.duplicate_count}</p>
          </div>
          <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.56)]">
            Max songs per action: {review.data.max_tracks_per_action}
          </p>
          {review.data.matched_sample.length > 0 ? (
            <div className="mt-3">
              <div className="rounded-xl border border-[color:rgb(var(--votuna-ink)/0.08)]">
                <Table style={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell className="w-[40%] !whitespace-normal">Song</TableHeaderCell>
                      <TableHeaderCell className="w-[32%] !whitespace-normal">Artist</TableHeaderCell>
                      <TableHeaderCell className="w-[28%] !whitespace-normal !px-3">Status</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedTracks.map((track) => {
                      const isDuplicate = duplicateTrackIdSet.has(track.provider_track_id)
                      return (
                        <TableRow key={`matched-${track.provider_track_id}`}>
                          <TableCell className="align-top !whitespace-normal">
                            <span className="block truncate" title={track.title}>
                              {track.title}
                            </span>
                          </TableCell>
                          <TableCell className="align-top !whitespace-normal">
                            <span className="block truncate" title={track.artist || 'Unknown artist'}>
                              {track.artist || 'Unknown artist'}
                            </span>
                          </TableCell>
                          <TableCell className="align-top !whitespace-normal !px-3">
                            <span
                              className={
                                isDuplicate
                                  ? 'inline-flex h-8 w-full max-w-[6.75rem] items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-[color:rgb(var(--votuna-ink)/0.24)] px-2 text-xs font-semibold leading-none text-[color:rgb(var(--votuna-ink)/0.82)]'
                                  : 'inline-flex h-8 w-full max-w-[6.75rem] items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-emerald-500/60 px-2 text-xs font-semibold leading-none text-emerald-600 dark:text-emerald-400'
                              }
                            >
                              {isDuplicate ? 'Duplicate' : 'Will copy'}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between pt-3 text-[11px] text-[color:rgb(var(--votuna-ink)/0.58)]">
                <p>
                  Showing {pageRangeStart}-{pageRangeEnd} of {matchedTracks.length}
                </p>
                <div className="flex gap-2">
                  <AppButton
                    intent="ghost"
                    size="xs"
                    disabled={!canGoPrev}
                    onClick={() => setTrackPage((prev) => Math.max(prev - 1, 0))}
                  >
                    Previous
                  </AppButton>
                  <AppButton
                    intent="ghost"
                    size="xs"
                    disabled={!canGoNext}
                    onClick={() => setTrackPage((prev) => prev + 1)}
                  >
                    Next
                  </AppButton>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {review.runError ? (
        <StatusCallout tone="error" title="Copy failed" className="mt-3">
          {review.runError}
        </StatusCallout>
      ) : null}

      {review.runResult ? (
        <Card className="mt-4 p-4">
          <p className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">Copy result</p>
          <div className="mt-2 grid gap-2 text-xs text-[color:rgb(var(--votuna-ink)/0.65)] sm:grid-cols-2">
            <p>Songs found: {review.runResult.matched_count}</p>
            <p>Copied: {review.runResult.added_count}</p>
            <p>Already in destination: {review.runResult.skipped_duplicate_count}</p>
            <p>Could not copy: {review.runResult.failed_count}</p>
          </div>
          {review.runResult.failed_items.length > 0 ? (
            <div className="mt-3">
              <StatusCallout tone="error" title="Failed items">
                Some songs could not be copied.
              </StatusCallout>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-rose-600">
                {review.runResult.failed_items.map((item, index) => (
                  <li key={`failed-${item.provider_track_id}`}>
                    Song {index + 1}: {item.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}
    </Card>
  )
}
