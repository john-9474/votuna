'use client'

import { Tab, TabGroup, TabList } from '@tremor/react'
import Link from 'next/link'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import CollaboratorsSection from '@/components/playlists/CollaboratorsSection'
import NowPlayingDock from '@/components/playlists/NowPlayingDock'
import PlaylistManagementSection from '@/components/playlists/PlaylistManagementSection'
import PlaylistSettingsSection from '@/components/playlists/PlaylistSettingsSection'
import SearchSuggestSection from '@/components/playlists/SearchSuggestSection'
import SuggestionsSection from '@/components/playlists/SuggestionsSection'
import TracksSection from '@/components/playlists/TracksSection'
import PageShell from '@/components/ui/PageShell'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'
import { usePlaylistDetailPage } from '@/lib/hooks/usePlaylistDetailPage'

const TAB_KEYS = ['playlist', 'manage', 'settings'] as const
type PlaylistTabKey = (typeof TAB_KEYS)[number]

const isPlaylistTab = (value: string | null): value is PlaylistTabKey => {
  return value !== null && TAB_KEYS.includes(value as PlaylistTabKey)
}

export default function PlaylistDetailPage() {
  const params = useParams()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const playlistId = Array.isArray(params.id) ? params.id[0] : params.id
  const storageKey = playlistId ? `votuna:playlist-tab:${playlistId}` : null

  const tabFromUrl = useMemo<PlaylistTabKey | null>(() => {
    const tab = searchParams.get('tab')
    return isPlaylistTab(tab) ? tab : null
  }, [searchParams])

  const [activeTab, setActiveTab] = useState<PlaylistTabKey>('playlist')

  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl)
      return
    }
    if (!storageKey || typeof window === 'undefined') {
      setActiveTab('playlist')
      return
    }
    const stored = window.sessionStorage.getItem(storageKey)
    setActiveTab(isPlaylistTab(stored) ? stored : 'playlist')
  }, [storageKey, tabFromUrl])

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    window.sessionStorage.setItem(storageKey, activeTab)
  }, [storageKey, activeTab])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      const tab = new URLSearchParams(window.location.search).get('tab')
      if (isPlaylistTab(tab)) {
        setActiveTab(tab)
        return
      }
      if (storageKey) {
        const stored = window.sessionStorage.getItem(storageKey)
        setActiveTab(isPlaylistTab(stored) ? stored : 'playlist')
        return
      }
      setActiveTab('playlist')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [storageKey])

  const activeTabIndex = TAB_KEYS.indexOf(activeTab)
  const state = usePlaylistDetailPage(playlistId, activeTab)

  const buildTabHref = (tab: PlaylistTabKey) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    if (tab === 'playlist') {
      nextParams.delete('tab')
    } else {
      nextParams.set('tab', tab)
    }
    const query = nextParams.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  const handleTabChange = (index: number) => {
    const tab = TAB_KEYS[index] ?? 'playlist'
    if (tab === activeTab) return
    const nextHref = buildTabHref(tab)
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      window.history.pushState({ tab }, '', nextHref)
    }
  }

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

        <TabGroup index={activeTabIndex} onIndexChange={handleTabChange}>
          <TabList className="rounded-full bg-[rgba(var(--votuna-paper),0.85)] p-1">
            <Tab className="rounded-full px-4 py-2 text-sm">Playlist</Tab>
            <Tab className="rounded-full px-4 py-2 text-sm">Manage</Tab>
            <Tab className="rounded-full px-4 py-2 text-sm">Settings</Tab>
          </TabList>
        </TabGroup>

        {activeTab === 'playlist' ? (
          <div className="space-y-6">
            {!state.isCollaborative ? (
              <SurfaceCard>
                <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                  No collaborators, invite someone in{' '}
                  <Link
                    href={buildTabHref('settings')}
                    className="font-semibold underline underline-offset-2"
                  >
                    settings
                  </Link>{' '}
                  to turn this into a collaborative playlist
                </p>
              </SurfaceCard>
            ) : null}
            <SearchSuggestSection
              isCollaborative={state.isCollaborative}
              searchQuery={state.searchQuery}
              onSearchQueryChange={state.setSearchQuery}
              onSearchTracks={state.searchTracks}
              isSearching={state.isSearching}
              searchStatus={state.searchStatus}
              searchResults={state.searchResults}
              optimisticSuggestedTrackIds={state.suggestedSearchTrackIds}
              pendingSuggestionTrackIds={state.pendingSuggestionTrackIds}
              inPlaylistTrackIds={state.inPlaylistTrackIds}
              onPlayTrack={state.playTrack}
              onSuggestFromSearch={state.suggestFromSearch}
              isSuggestPending={state.isSuggestPending}
              linkSuggestionUrl={state.linkSuggestionUrl}
              onLinkSuggestionUrlChange={state.setLinkSuggestionUrl}
              onSuggestFromLink={state.suggestFromLink}
              suggestStatus={state.suggestStatus}
              recommendedTracks={state.recommendedTracks}
              recommendationsStatus={state.recommendationsStatus}
              isRecommendationsLoading={state.isRecommendationsLoading}
              onRefreshRecommendations={state.refreshRecommendations}
              onAcceptRecommendation={state.acceptRecommendation}
              onDeclineRecommendation={state.declineRecommendation}
              isRecommendationActionPending={state.isRecommendationActionPending}
            />

            {state.isCollaborative ? (
              <SuggestionsSection
                suggestions={state.suggestions}
                isLoading={state.isSuggestionsLoading}
                memberNameById={state.memberNameById}
                onPlayTrack={state.playTrack}
                onSetReaction={state.setReaction}
                isReactionPending={state.isReactionPending}
                onCancelSuggestion={state.cancelSuggestion}
                isCancelPending={state.isCancelSuggestionPending}
                onForceAddSuggestion={state.forceAddSuggestion}
                isForceAddPending={state.isForceAddPending}
                statusMessage={state.suggestionsActionStatus}
              />
            ) : null}

            <TracksSection
              tracks={state.tracks}
              isLoading={state.isTracksLoading}
              onPlayTrack={state.playTrack}
              canRemoveTracks={state.canEditSettings}
              onRemoveTrack={state.removeTrack}
              isRemoveTrackPending={state.isRemoveTrackPending}
              removingTrackId={state.removingTrackId}
              statusMessage={state.trackActionStatus}
            />
          </div>
        ) : null}

        {activeTab === 'manage' ? <PlaylistManagementSection management={state.management} /> : null}

        {activeTab === 'settings' ? (
          <div className="space-y-6">
            <PlaylistSettingsSection
              requiredVotePercent={state.settingsForm.required_vote_percent}
              tieBreakMode={state.settingsForm.tie_break_mode}
              playlistType={state.playlistType}
              collaboratorCount={state.collaboratorCount}
              canEditSettings={state.canEditSettings}
              isSaving={state.isSettingsSaving}
              isSwitchingToPersonal={state.isSwitchingToPersonal}
              settingsStatus={state.settingsStatus}
              onSaveSettings={state.saveSettings}
              onSwitchToPersonal={state.switchToPersonal}
              onRequiredVotePercentChange={state.setRequiredVotePercent}
              onTieBreakModeChange={state.setTieBreakMode}
            />
            <CollaboratorsSection
              members={state.members}
              isLoading={state.isMembersLoading}
              invites={state.invites}
            />
          </div>
        ) : null}
      </div>
      {state.activePlayerTrack ? (
        <NowPlayingDock track={state.activePlayerTrack} onClose={state.closePlayer} />
      ) : null}
    </PageShell>
  )
}
