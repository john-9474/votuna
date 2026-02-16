import { RiPlayFill, RiThumbDownLine, RiThumbUpLine } from '@remixicon/react'
import { Text } from '@tremor/react'
import Image from 'next/image'

import type { ProviderTrack, TrackPlayRequest } from '@/lib/types/votuna'
import AppPanelRow from '@/components/ui/AppPanelRow'
import AppSectionHeader from '@/components/ui/AppSectionHeader'
import AppButton from '@/components/ui/AppButton'
import ClearableTextInput from '@/components/ui/ClearableTextInput'
import StatusCallout from '@/components/ui/StatusCallout'
import SurfaceCard from '@/components/ui/SurfaceCard'

import TrackArtwork from './TrackArtwork'

type SearchSuggestSectionProps = {
  provider: string
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

const getProviderLabel = (provider: string) => {
  const normalized = provider.trim().toLowerCase()
  if (normalized === 'spotify') return 'Spotify'
  if (normalized === 'soundcloud') return 'SoundCloud'
  if (normalized === 'apple') return 'Apple Music'
  if (normalized === 'tidal') return 'TIDAL'
  return 'provider'
}

const getTrackLinkPlaceholder = (provider: string) => {
  const normalized = provider.trim().toLowerCase()
  if (normalized === 'spotify') return 'https://open.spotify.com/track/<track-id>'
  if (normalized === 'soundcloud') return 'https://soundcloud.com/artist/track-name'
  return 'Paste a track link'
}

export default function SearchSuggestSection({
  provider,
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
  const providerLabel = getProviderLabel(provider)
  const isTrackSuggested = (providerTrackId: string) =>
    optimisticSuggestedTrackIds.includes(providerTrackId) ||
    pendingSuggestionTrackIds.includes(providerTrackId)

  const isTrackInPlaylist = (providerTrackId: string) => inPlaylistTrackIds.includes(providerTrackId)

  return (
    <SurfaceCard>
      <AppSectionHeader
        eyebrow={isCollaborative ? 'Find and suggest tracks' : 'Find and add tracks'}
        description={
          isCollaborative
            ? `Search ${providerLabel} tracks, play the track, and suggest it to the vote queue.`
            : `Search ${providerLabel} tracks, play the track, and add it directly to your playlist.`
        }
      />

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
          placeholder={`Search ${providerLabel} tracks`}
          containerClassName="flex-1"
          clearAriaLabel="Clear track search"
        />
        <AppButton type="submit" disabled={isSearching || !searchQuery.trim()}>
          {isSearching ? 'Searching...' : 'Search'}
        </AppButton>
      </form>

      {searchStatus ? (
        <StatusCallout tone="error" title="Search status" className="mt-3">
          {searchStatus}
        </StatusCallout>
      ) : null}

      {searchResults.length > 0 ? (
        <div className="mt-4 space-y-3">
          {searchResults.map((track) => (
            <AppPanelRow key={track.provider_track_id} className="p-4">
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
                      <Text className="truncate text-sm font-semibold text-[rgb(var(--votuna-ink))]">{track.title}</Text>
                    )}
                    <Text className="mt-1 truncate text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                      {track.artist || 'Unknown artist'}
                    </Text>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {track.url ? (
                    <AppButton
                      intent="secondary"
                      onClick={() =>
                        onPlayTrack({
                          key: `search-${track.provider_track_id}`,
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
                  {isTrackInPlaylist(track.provider_track_id) ? (
                    <AppButton disabled intent="secondary" className="w-24 justify-center">
                      In playlist
                    </AppButton>
                  ) : isCollaborative && isTrackSuggested(track.provider_track_id) ? (
                    <AppButton disabled intent="secondary" className="w-24 justify-center">
                      Suggested
                    </AppButton>
                  ) : (
                    <AppButton
                      onClick={() => onSuggestFromSearch(track)}
                      disabled={isSuggestPending}
                      className="w-24 justify-center"
                    >
                      {isCollaborative ? 'Suggest' : 'Add'}
                    </AppButton>
                  )}
                </div>
              </div>
            </AppPanelRow>
          ))}
        </div>
      ) : null}

      <div className="mt-6 border-t border-[color:rgb(var(--votuna-ink)/0.08)] pt-5">
        <AppSectionHeader
          eyebrow={isCollaborative ? 'Suggest directly from link' : 'Add directly from link'}
          className="gap-0"
          descriptionClassName="mt-0"
        />
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
            placeholder={getTrackLinkPlaceholder(provider)}
            containerClassName="flex-1"
            clearAriaLabel="Clear track link"
          />
          <AppButton type="submit" disabled={isSuggestPending || !linkSuggestionUrl.trim()}>
            {isSuggestPending ? 'Adding...' : isCollaborative ? 'Suggest from link' : 'Add from link'}
          </AppButton>
        </form>
      </div>
      {suggestStatus ? (
        <StatusCallout tone="error" title="Suggestion status" className="mt-3">
          {suggestStatus}
        </StatusCallout>
      ) : null}

      <div className="mt-6 border-t border-[color:rgb(var(--votuna-ink)/0.08)] pt-5">
        <AppSectionHeader
          eyebrow="Suggested for this playlist"
          actions={
            <AppButton
              intent="secondary"
              onClick={onRefreshRecommendations}
              disabled={isRecommendationsLoading || inPlaylistTrackIds.length === 0}
            >
              Refresh
            </AppButton>
          }
          className="items-center"
          descriptionClassName="mt-0"
        />

        {inPlaylistTrackIds.length === 0 ? (
          <Text className="mt-3 text-sm text-[color:rgb(var(--votuna-ink)/0.62)]">
            Add tracks to this playlist to generate recommendations.
          </Text>
        ) : isRecommendationsLoading && recommendedTracks.length === 0 ? (
          <Text className="mt-3 text-sm text-[color:rgb(var(--votuna-ink)/0.62)]">Loading recommendations...</Text>
        ) : recommendedTracks.length === 0 ? (
          <Text className="mt-3 text-sm text-[color:rgb(var(--votuna-ink)/0.62)]">No more recommendations right now.</Text>
        ) : (
          <div className="mt-4 -mx-1 snap-x snap-mandatory overflow-x-auto pb-2 scroll-smooth">
            <div className="mx-auto flex w-fit min-w-max gap-4 px-1">
              {recommendedTracks.map((track) => {
                const inPlaylist = isTrackInPlaylist(track.provider_track_id)
                const suggested = isCollaborative && isTrackSuggested(track.provider_track_id)
                const disableAccept =
                  isRecommendationActionPending ||
                  isRecommendationsLoading ||
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
                        <Text className="truncate text-sm font-semibold text-[rgb(var(--votuna-ink))]">{track.title}</Text>
                      )}
                      <Text className="mt-1 truncate text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                        {track.artist || 'Unknown artist'}
                      </Text>
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <AppButton
                        type="button"
                        intent="icon"
                        onClick={() => onAcceptRecommendation(track)}
                        title={isCollaborative ? 'Suggest track' : 'Add track'}
                        aria-label={isCollaborative ? 'Suggest track' : 'Add track'}
                        disabled={disableAccept}
                        color="emerald"
                      >
                        <RiThumbUpLine className="h-5 w-5" />
                      </AppButton>
                      <AppButton
                        type="button"
                        intent="icon"
                        onClick={() => onDeclineRecommendation(track)}
                        title="Decline recommendation"
                        aria-label="Decline recommendation"
                        disabled={isRecommendationActionPending || isRecommendationsLoading}
                        color="rose"
                      >
                        <RiThumbDownLine className="h-5 w-5" />
                      </AppButton>
                    </div>
                    {inPlaylist ? (
                      <Text className="mt-2 text-center text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">In playlist</Text>
                    ) : suggested ? (
                      <Text className="mt-2 text-center text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">Suggested</Text>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      {recommendationsStatus ? (
        <StatusCallout tone="error" title="Recommendations status" className="mt-3">
          {recommendationsStatus}
        </StatusCallout>
      ) : null}
    </SurfaceCard>
  )
}
