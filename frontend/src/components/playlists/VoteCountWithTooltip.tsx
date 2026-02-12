type VoteCountWithTooltipProps = {
  upvoteCount: number
  downvoteCount: number
  upvoters?: string[]
  downvoters?: string[]
  collaboratorsLeftToVoteCount: number
  collaboratorsLeftToVoteNames: string[]
}

export default function VoteCountWithTooltip({
  upvoteCount,
  downvoteCount,
  upvoters,
  downvoters,
  collaboratorsLeftToVoteCount,
  collaboratorsLeftToVoteNames,
}: VoteCountWithTooltipProps) {
  const leftToVoteText =
    collaboratorsLeftToVoteNames.length > 0
      ? collaboratorsLeftToVoteNames.join(', ')
      : collaboratorsLeftToVoteCount === 0
        ? 'None'
        : `${collaboratorsLeftToVoteCount} collaborator${collaboratorsLeftToVoteCount === 1 ? '' : 's'}`
  const upvotersText = upvoters && upvoters.length > 0 ? upvoters.join(', ') : ''
  const downvotersText = downvoters && downvoters.length > 0 ? downvoters.join(', ') : ''

  return (
    <span className="group relative inline-flex items-center">
      <span
        tabIndex={0}
        className="cursor-help rounded-sm underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--votuna-accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--votuna-paper))]"
      >
        {upvoteCount} up / {downvoteCount} down
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max min-w-[220px] max-w-[280px] -translate-x-1/2 rounded-xl border border-[color:rgb(var(--votuna-ink)/0.2)] bg-[rgb(var(--votuna-paper))] px-3 py-2 text-left opacity-0 shadow-lg shadow-black/30 transition duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="block text-[10px] uppercase tracking-[0.18em] text-[color:rgb(var(--votuna-ink)/0.45)]">
          Reactions
        </span>
        <span className="mt-1 block text-xs text-[color:rgb(var(--votuna-ink)/0.8)]">
          Thumbs up: {upvoteCount}
        </span>
        <span className="block text-xs text-[color:rgb(var(--votuna-ink)/0.8)]">
          Thumbs down: {downvoteCount}
        </span>
        <span className="mt-2 block text-xs font-semibold text-[color:rgb(var(--votuna-ink)/0.7)]">
          Left to vote:
        </span>
        <span className="block text-xs text-[color:rgb(var(--votuna-ink)/0.8)]">{leftToVoteText}</span>
        {upvotersText ? (
          <>
            <span className="mt-2 block text-xs font-semibold text-[color:rgb(var(--votuna-ink)/0.7)]">
              Upvoters
            </span>
            <span className="block text-xs text-[color:rgb(var(--votuna-ink)/0.8)]">{upvotersText}</span>
          </>
        ) : null}
        {downvotersText ? (
          <>
            <span className="mt-2 block text-xs font-semibold text-[color:rgb(var(--votuna-ink)/0.7)]">
              Downvoters
            </span>
            <span className="block text-xs text-[color:rgb(var(--votuna-ink)/0.8)]">{downvotersText}</span>
          </>
        ) : null}
      </span>
    </span>
  )
}
