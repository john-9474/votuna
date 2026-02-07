'use client'

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@tremor/react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import CollaboratorsSection from '@/components/playlists/CollaboratorsSection'
import NowPlayingDock from '@/components/playlists/NowPlayingDock'
import PlaylistSettingsSection from '@/components/playlists/PlaylistSettingsSection'
import SearchSuggestSection from '@/components/playlists/SearchSuggestSection'
import SuggestionsSection from '@/components/playlists/SuggestionsSection'
import TracksSection from '@/components/playlists/TracksSection'
import PageShell from '@/components/ui/PageShell'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { usePlaylistDetailPage } from '@/hooks/usePlaylistDetailPage'

export default function PlaylistDetailPage() {
  const params = useParams()
  const playlistId = Array.isArray(params.id) ? params.id[0] : params.id
  const state = usePlaylistDetailPage(playlistId)

  if (state.isPlaylistLoading) {
    return (
      <PageShell>
        <SurfaceCard>
          <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading playlist...</p>
        </SurfaceCard>
      </PageShell>
    )
  }

  if (!state.playlist) {
    return (
      <PageShell>
        <SurfaceCard>
          <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Playlist not found.</p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center rounded-full bg-[rgb(var(--votuna-ink))] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-paper))]"
          >
            Back to dashboard
          </Link>
        </SurfaceCard>
      </PageShell>
    )
  }

  return (
    <PageShell className="pb-44">
      <div className="fade-up space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <SectionEyebrow>Playlist</SectionEyebrow>
            <h1 className="mt-2 text-3xl font-semibold text-[rgb(var(--votuna-ink))]">
              {state.playlist.title}
            </h1>
            {state.playlist.description ? (
              <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                {state.playlist.description}
              </p>
            ) : null}
          </div>
          <Link
            href="/"
            className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.15)] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-ink))] hover:bg-[rgba(var(--votuna-paper),0.7)]"
          >
            Back
          </Link>
        </div>

        <TabGroup>
          <TabList className="rounded-full bg-[rgba(var(--votuna-paper),0.85)] p-1">
            <Tab className="rounded-full px-4 py-2 text-sm">Playlist</Tab>
            <Tab className="rounded-full px-4 py-2 text-sm">Settings</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <div className="space-y-6">
                <SearchSuggestSection
                  searchQuery={state.searchQuery}
                  onSearchQueryChange={state.setSearchQuery}
                  onSearchTracks={state.searchTracks}
                  isSearching={state.isSearching}
                  searchStatus={state.searchStatus}
                  searchResults={state.searchResults}
                  onPlayTrack={state.playTrack}
                  onSuggestFromSearch={state.suggestFromSearch}
                  isSuggestPending={state.isSuggestPending}
                  linkSuggestionUrl={state.linkSuggestionUrl}
                  onLinkSuggestionUrlChange={state.setLinkSuggestionUrl}
                  onSuggestFromLink={state.suggestFromLink}
                  suggestStatus={state.suggestStatus}
                />

                <SuggestionsSection
                  suggestions={state.suggestions}
                  isLoading={state.isSuggestionsLoading}
                  memberNameById={state.memberNameById}
                  onPlayTrack={state.playTrack}
                  onVote={state.vote}
                  isVotePending={state.isVotePending}
                />

                <TracksSection
                  tracks={state.tracks}
                  isLoading={state.isTracksLoading}
                  onPlayTrack={state.playTrack}
                />
              </div>
            </TabPanel>
            <TabPanel>
              <div className="space-y-6">
                <PlaylistSettingsSection
                  requiredVotePercent={state.settingsForm.required_vote_percent}
                  autoAddOnThreshold={state.settingsForm.auto_add_on_threshold}
                  canEditSettings={state.canEditSettings}
                  isSaving={state.isSettingsSaving}
                  settingsStatus={state.settingsStatus}
                  onSaveSettings={state.saveSettings}
                  onRequiredVotePercentChange={state.setRequiredVotePercent}
                  onAutoAddOnThresholdChange={state.setAutoAddOnThreshold}
                />
                <CollaboratorsSection members={state.members} isLoading={state.isMembersLoading} />
              </div>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
      {state.activePlayerTrack ? (
        <NowPlayingDock
          track={state.activePlayerTrack}
          playerNonce={state.playerNonce}
          onClose={state.closePlayer}
        />
      ) : null}
    </PageShell>
  )
}
