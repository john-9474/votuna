import { RiAddLine, RiCloseLine, RiThumbDownLine, RiThumbUpLine } from '@remixicon/react'

import type { Suggestion, TrackPlayRequest } from '@/lib/types/votuna'
import AppButton from '@/components/ui/AppButton'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import StatusCallout from '@/components/ui/StatusCallout'
import SurfaceCard from '@/components/ui/SurfaceCard'

import TrackArtwork from './TrackArtwork'
import VoteCountWithTooltip from './VoteCountWithTooltip'

type SuggestionsSectionProps = {
  suggestions: Suggestion[]
  isLoading: boolean
  memberNameById: ReadonlyMap<number, string>
  onPlayTrack: (track: TrackPlayRequest) => void
  onSetReaction: (suggestionId: number, reaction: 'up' | 'down') => void
  isReactionPending: boolean
  onCancelSuggestion: (suggestionId: number) => void
  isCancelPending: boolean
  onForceAddSuggestion: (suggestionId: number) => void
  isForceAddPending: boolean
  statusMessage?: string
}

const formatAddedDate = (addedAt: string | null | undefined) => {
  if (!addedAt) return 'Added date unavailable'
  const date = new Date(addedAt)
  if (Number.isNaN(date.getTime())) return 'Added date unavailable'
  return `Added ${date.toLocaleDateString()}`
}

export default function SuggestionsSection({
  suggestions,
  isLoading,
  memberNameById,
  onPlayTrack,
  onSetReaction,
  isReactionPending,
  onCancelSuggestion,
  isCancelPending,
  onForceAddSuggestion,
  isForceAddPending,
  statusMessage,
}: SuggestionsSectionProps) {
  return (
    <SurfaceCard>
      <div className="flex items-center justify-between">
        <div>
          <SectionEyebrow>Active suggestions</SectionEyebrow>
          <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
            React with thumbs up or down to resolve each track.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading suggestions...</p>
      ) : suggestions.length === 0 ? (
        <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">No active suggestions yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.8)] px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <TrackArtwork
                    artworkUrl={suggestion.track_artwork_url}
                    title={suggestion.track_title || 'Untitled track'}
                  />
                  <div className="min-w-0">
                    {suggestion.track_url ? (
                      <a
                        href={suggestion.track_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-semibold text-[rgb(var(--votuna-ink))] hover:underline"
                      >
                        {suggestion.track_title || 'Untitled track'}
                      </a>
                    ) : (
                      <p className="truncate text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                        {suggestion.track_title || 'Untitled track'}
                      </p>
                    )}
                    <div className="mt-1 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                      {suggestion.track_artist || 'Unknown artist'} -{' '}
                      <VoteCountWithTooltip
                        upvoteCount={suggestion.upvote_count}
                        downvoteCount={suggestion.downvote_count}
                        upvoters={suggestion.upvoter_display_names}
                        downvoters={suggestion.downvoter_display_names}
                        collaboratorsLeftToVoteCount={suggestion.collaborators_left_to_vote_count || 0}
                        collaboratorsLeftToVoteNames={suggestion.collaborators_left_to_vote_names || []}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-3 text-right sm:w-auto sm:justify-end">
                  <div className="min-w-0">
                    <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
                      {suggestion.suggested_by_user_id
                        ? memberNameById.get(suggestion.suggested_by_user_id)
                          ? `Suggested by ${memberNameById.get(suggestion.suggested_by_user_id)}`
                          : 'Suggested by a former member'
                        : 'Suggested outside Votuna'}
                    </p>
                    <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.5)] tabular-nums">
                      {formatAddedDate(suggestion.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {suggestion.track_url ? (
                      <AppButton
                        intent="secondary"
                        onClick={() =>
                          onPlayTrack({
                            key: `suggestion-${suggestion.id}`,
                            title: suggestion.track_title || 'Untitled track',
                            artist: suggestion.track_artist,
                            url: suggestion.track_url,
                            artworkUrl: suggestion.track_artwork_url,
                          })
                        }
                        className="w-24 justify-center"
                      >
                        Play
                      </AppButton>
                    ) : null}
                    <AppButton
                      type="button"
                      intent="icon"
                      variant={suggestion.my_reaction === 'up' ? 'primary' : 'secondary'}
                      color="emerald"
                      disabled={isReactionPending}
                      aria-label="Thumbs up"
                      onClick={() => onSetReaction(suggestion.id, 'up')}
                    >
                      <RiThumbUpLine className="h-4 w-4" />
                    </AppButton>
                    <AppButton
                      type="button"
                      intent="icon"
                      variant={suggestion.my_reaction === 'down' ? 'primary' : 'secondary'}
                      color="rose"
                      disabled={isReactionPending}
                      aria-label="Thumbs down"
                      onClick={() => onSetReaction(suggestion.id, 'down')}
                    >
                      <RiThumbDownLine className="h-4 w-4" />
                    </AppButton>
                    {suggestion.can_cancel ? (
                      <AppButton
                        type="button"
                        intent="icon"
                        color="rose"
                        aria-label="Cancel suggestion"
                        disabled={isCancelPending}
                        onClick={() => onCancelSuggestion(suggestion.id)}
                      >
                        <RiCloseLine className="h-4 w-4" />
                      </AppButton>
                    ) : null}
                    {suggestion.can_force_add ? (
                      <AppButton
                        type="button"
                        intent="success"
                        onClick={() => onForceAddSuggestion(suggestion.id)}
                        disabled={isForceAddPending}
                      >
                        <RiAddLine className="h-4 w-4" />
                        Force add
                      </AppButton>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {statusMessage ? (
        <StatusCallout tone="error" title="Suggestion status" className="mt-3">
          {statusMessage}
        </StatusCallout>
      ) : null}
    </SurfaceCard>
  )
}
