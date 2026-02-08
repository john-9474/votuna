import { RiPlayFill, RiThumbDownLine, RiThumbUpLine } from '@remixicon/react'
import { Button } from '@tremor/react'
import Image from 'next/image'

import type { ProviderTrack, TrackPlayRequest } from '@/lib/types/votuna'
import ClearableTextInput from '@/components/ui/ClearableTextInput'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'

import TrackArtwork from './TrackArtwork'

type SearchSuggestSectionProps = {
  isCollaborative: boolean
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onSearchTracks: () => void
  isSearching: boolean
  searchStatus: string
  searchResults: ProviderTrack[]
  optimisticSuggestedTrackIds: string[]
  pendingSuggestionTrackIds: string[]
  inPlaylistTrackIds: string[]
  onPlayTrack: (track: TrackPlayRequest) => void
  onSuggestFromSearch: (track: ProviderTrack) => void
  isSuggestPending: boolean
  linkSuggestionUrl: string
  onLinkSuggestionUrlChange: (value: string) => void
  onSuggestFromLink: () => void
  suggestStatus: string
  recommendedTracks: ProviderTrack[]
  recommendationsStatus: string
  isRecommendationsLoading: boolean
  onRefreshRecommendations: () => void
  onAcceptRecommendation: (track: ProviderTrack) => void
  onDeclineRecommendation: (track: ProviderTrack) => void
  isRecommendationActionPending: boolean
}

export default function SearchSuggestSection({
  isCollaborative,
  searchQuery,
  onSearchQueryChange,
  onSearchTracks,
  isSearching,
  searchStatus,
  searchResults,
  optimisticSuggestedTrackIds,
  pendingSuggestionTrackIds,
  inPlaylistTrackIds,
  onPlayTrack,
  onSuggestFromSearch,
  isSuggestPending,
  linkSuggestionUrl,
  onLinkSuggestionUrlChange,
  onSuggestFromLink,
  suggestStatus,
  recommendedTracks,
  recommendationsStatus,
  isRecommendationsLoading,
  onRefreshRecommendations,
  onAcceptRecommendation,
  onDeclineRecommendation,
  isRecommendationActionPending,
}: SearchSuggestSectionProps) {
  const isTrackSuggested = (providerTrackId: string) =>
    optimisticSuggestedTrackIds.includes(providerTrackId) ||
    pendingSuggestionTrackIds.includes(providerTrackId)

  const isTrackInPlaylist = (providerTrackId: string) => inPlaylistTrackIds.includes(providerTrackId)

  return (
    <SurfaceCard>
      <div>
        <SectionEyebrow>{isCollaborative ? 'Find and suggest tracks' : 'Find and add tracks'}</SectionEyebrow>
        <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
          {isCollaborative
            ? 'Search by track name, play the track, and suggest it to the vote queue.'
            : 'Search by track name, play the track, and add it directly to your playlist.'}
        </p>
      </div>

      <form
        className="mt-6 flex flex-wrap items-center gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (isSearching || !searchQuery.trim()) return
          onSearchTracks()
        }}
      >
        <ClearableTextInput
          value={searchQuery}
          onValueChange={onSearchQueryChange}
          placeholder="Search SoundCloud tracks"
          containerClassName="flex-1"
          clearAriaLabel="Clear track search"
        />
        <PrimaryButton
          type="submit"
          disabled={isSearching || !searchQuery.trim()}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </PrimaryButton>
      </form>

      {searchStatus ? <p className="mt-3 text-xs text-rose-500">{searchStatus}</p> : null}

      {searchResults.length > 0 ? (
        <div className="mt-4 space-y-3">
          {searchResults.map((track) => (
            <div
              key={track.provider_track_id}
              className="rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.8)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                      <p className="truncate text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                        {track.title}
                      </p>
                    )}
                    <p className="mt-1 truncate text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                      {track.artist || 'Unknown artist'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {track.url ? (
                    <Button
                      onClick={() =>
                        onPlayTrack({
                          key: `search-${track.provider_track_id}`,
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
                  {isTrackInPlaylist(track.provider_track_id) ? (
                    <Button
                      disabled
                      variant="secondary"
                      className="w-24 justify-center rounded-full"
                    >
                      In playlist
                    </Button>
                  ) : isCollaborative && isTrackSuggested(track.provider_track_id) ? (
                    <Button
                      disabled
                      variant="secondary"
                      className="w-24 justify-center rounded-full"
                    >
                      Suggested
                    </Button>
                  ) : (
                    <PrimaryButton
                      onClick={() => onSuggestFromSearch(track)}
                      disabled={isSuggestPending}
                      className="w-24 justify-center"
                    >
                      {isCollaborative ? 'Suggest' : 'Add'}
                    </PrimaryButton>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6 border-t border-[color:rgb(var(--votuna-ink)/0.08)] pt-5">
        <p className="text-xs uppercase tracking-[0.22em] text-[color:rgb(var(--votuna-ink)/0.45)]">
          {isCollaborative ? 'Suggest directly from link' : 'Add directly from link'}
        </p>
        <form
          className="mt-3 flex flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (isSuggestPending || !linkSuggestionUrl.trim()) return
            onSuggestFromLink()
          }}
        >
          <ClearableTextInput
            value={linkSuggestionUrl}
            onValueChange={onLinkSuggestionUrlChange}
            placeholder="https://soundcloud.com/artist/track-name"
            containerClassName="flex-1"
            clearAriaLabel="Clear track link"
          />
          <PrimaryButton
            type="submit"
            disabled={isSuggestPending || !linkSuggestionUrl.trim()}
          >
            {isSuggestPending ? 'Adding...' : isCollaborative ? 'Suggest from link' : 'Add from link'}
          </PrimaryButton>
        </form>
      </div>
      {suggestStatus ? <p className="mt-3 text-xs text-rose-500">{suggestStatus}</p> : null}

      <div className="mt-6 border-t border-[color:rgb(var(--votuna-ink)/0.08)] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:rgb(var(--votuna-ink)/0.45)]">
            Suggested for this playlist
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={onRefreshRecommendations}
              variant="secondary"
              className="rounded-full"
              disabled={isRecommendationsLoading || inPlaylistTrackIds.length === 0}
            >
              Refresh
            </Button>
          </div>
        </div>

        {inPlaylistTrackIds.length === 0 ? (
          <p className="mt-3 text-sm text-[color:rgb(var(--votuna-ink)/0.62)]">
            Add tracks to this playlist to generate recommendations.
          </p>
        ) : isRecommendationsLoading && recommendedTracks.length === 0 ? (
          <p className="mt-3 text-sm text-[color:rgb(var(--votuna-ink)/0.62)]">
            Loading recommendations...
          </p>
        ) : recommendedTracks.length === 0 ? (
          <p className="mt-3 text-sm text-[color:rgb(var(--votuna-ink)/0.62)]">
            No more recommendations right now.
          </p>
        ) : (
          <div className="mt-4 -mx-1 snap-x snap-mandatory overflow-x-auto pb-2 scroll-smooth">
            <div className="mx-auto flex w-fit min-w-max gap-4 px-1">
              {recommendedTracks.map((track) => {
                const inPlaylist = isTrackInPlaylist(track.provider_track_id)
                const suggested = isCollaborative && isTrackSuggested(track.provider_track_id)
                const disableAccept =
                  isRecommendationActionPending ||
                  isSuggestPending ||
                  inPlaylist ||
                  suggested

                return (
                  <div
                    key={`recommended-${track.provider_track_id}`}
                    className="w-[180px] flex-shrink-0 snap-start"
                  >
                    <div className="relative overflow-hidden rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.75)]">
                      {track.artwork_url ? (
                        <Image
                          src={track.artwork_url}
                          alt={`${track.title} artwork`}
                          width={176}
                          height={176}
                          unoptimized
                          className="h-44 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-44 w-full items-center justify-center bg-[rgba(var(--votuna-ink),0.05)] text-[10px] uppercase tracking-[0.16em] text-[color:rgb(var(--votuna-ink)/0.45)]">
                          No Art
                        </div>
                      )}
                      {track.url ? (
                        <button
                          type="button"
                          onClick={() =>
                            onPlayTrack({
                              key: `recommended-${track.provider_track_id}`,
                              title: track.title,
                              artist: track.artist,
                              url: track.url,
                              artworkUrl: track.artwork_url,
                            })
                          }
                          aria-label={`Play ${track.title}`}
                          className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/25 focus:bg-black/25"
                        >
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/45 bg-white/20 text-white backdrop-blur-sm">
                            <RiPlayFill className="h-6 w-6" />
                          </span>
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 min-w-0">
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
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAcceptRecommendation(track)}
                        title={isCollaborative ? 'Suggest track' : 'Add track'}
                        aria-label={isCollaborative ? 'Suggest track' : 'Add track'}
                        disabled={disableAccept}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50/70 text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100/80 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RiThumbUpLine className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeclineRecommendation(track)}
                        title="Decline recommendation"
                        aria-label="Decline recommendation"
                        disabled={isRecommendationActionPending || isRecommendationsLoading}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-300 bg-rose-50/70 text-rose-600 transition hover:border-rose-400 hover:bg-rose-100/80 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RiThumbDownLine className="h-5 w-5" />
                      </button>
                    </div>
                    {inPlaylist ? (
                      <p className="mt-2 text-center text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">In playlist</p>
                    ) : suggested ? (
                      <p className="mt-2 text-center text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">Suggested</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      {recommendationsStatus ? <p className="mt-3 text-xs text-rose-500">{recommendationsStatus}</p> : null}
    </SurfaceCard>
  )
}
