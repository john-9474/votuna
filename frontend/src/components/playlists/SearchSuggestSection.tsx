import { Button } from '@tremor/react'

import type { ProviderTrack, TrackPlayRequest } from '@/lib/types/votuna'
import ClearableTextInput from '@/components/ui/ClearableTextInput'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'

import TrackArtwork from './TrackArtwork'

type SearchSuggestSectionProps = {
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
}

export default function SearchSuggestSection({
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
}: SearchSuggestSectionProps) {
  const isTrackSuggested = (providerTrackId: string) =>
    optimisticSuggestedTrackIds.includes(providerTrackId) ||
    pendingSuggestionTrackIds.includes(providerTrackId)

  const isTrackInPlaylist = (providerTrackId: string) => inPlaylistTrackIds.includes(providerTrackId)

  return (
    <SurfaceCard>
      <div>
        <SectionEyebrow>Find and suggest tracks</SectionEyebrow>
        <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
          Search by track name, play the track, and suggest it to the vote queue.
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
                  ) : isTrackSuggested(track.provider_track_id) ? (
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
                      Suggest
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
          Suggest directly from link
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
            {isSuggestPending ? 'Adding...' : 'Suggest from link'}
          </PrimaryButton>
        </form>
      </div>
      {suggestStatus ? <p className="mt-3 text-xs text-rose-500">{suggestStatus}</p> : null}
    </SurfaceCard>
  )
}
