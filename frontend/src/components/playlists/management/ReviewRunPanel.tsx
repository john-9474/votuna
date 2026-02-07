import PrimaryButton from '@/components/ui/PrimaryButton'
import type { PlaylistManagementState } from '@/lib/hooks/playlistDetail/usePlaylistManagement'

const SAMPLE_LIMIT = 5

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
            <ul className="mt-3 space-y-1 text-xs text-[color:rgb(var(--votuna-ink)/0.65)]">
              {review.data.matched_sample.slice(0, SAMPLE_LIMIT).map((track) => (
                <li key={`matched-${track.provider_track_id}`}>
                  {track.title} ({track.provider_track_id})
                </li>
              ))}
            </ul>
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
              {review.runResult.failed_items.slice(0, SAMPLE_LIMIT).map((item) => (
                <li key={`failed-${item.provider_track_id}`}>
                  {item.provider_track_id}: {item.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

