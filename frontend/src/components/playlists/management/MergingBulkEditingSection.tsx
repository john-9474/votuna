import { Card, Select, SelectItem, Switch, Tab, TabGroup, TabList } from '@tremor/react'

import ClearableInput from '@/components/ui/ClearableInput'
import AppButton from '@/components/ui/AppButton'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import StatusCallout from '@/components/ui/StatusCallout'
import SurfaceCard from '@/components/ui/SurfaceCard'
import type { PlaylistManagementState } from '@/lib/hooks/playlistDetail/usePlaylistManagement'

import FacetSelector from './FacetSelector'
import PlaylistGridPicker from './PlaylistGridPicker'
import ReviewRunPanel from './ReviewRunPanel'

type MergingBulkEditingSectionProps = {
  management: PlaylistManagementState
}

const SONG_SCOPE_OPTIONS: Array<{ value: PlaylistManagementState['songScope']['value']; label: string }> = [
  { value: 'all', label: 'All songs' },
  { value: 'genre', label: 'Only specific genres' },
  { value: 'artist', label: 'Only specific artists' },
  { value: 'songs', label: 'Pick songs manually' },
]

export default function MergingBulkEditingSection({ management }: MergingBulkEditingSectionProps) {
  const { action, playlists, songScope, steps } = management
  const { sourcePicker } = songScope
  const {
    limit: sourceTrackLimit,
    offset: sourceTrackOffset,
    totalCount: sourceTrackTotalCount,
    setOffset: setSourceTrackOffset,
  } = sourcePicker.pagination

  const selectedSongIdSet = new Set(sourcePicker.selectedSongIds)
  const canPageBack = sourceTrackOffset > 0
  const nextOffset = sourceTrackOffset + sourceTrackLimit
  const canPageForward = nextOffset < sourceTrackTotalCount
  const rangeStart = sourceTrackTotalCount === 0 ? 0 : sourceTrackOffset + 1
  const rangeEnd =
    sourceTrackTotalCount === 0
      ? 0
      : Math.min(sourceTrackOffset + sourceTrackLimit, sourceTrackTotalCount)
  const visibleTrackIds = sourcePicker.tracks.map((track) => track.provider_track_id)
  const selectedVisibleTrackCount = visibleTrackIds.reduce(
    (count, trackId) => count + (selectedSongIdSet.has(trackId) ? 1 : 0),
    0,
  )
  const allVisibleTracksSelected =
    visibleTrackIds.length > 0 && selectedVisibleTrackCount === visibleTrackIds.length

  const toggleVisibleTracksSelection = () => {
    if (allVisibleTracksSelected) {
      for (const trackId of visibleTrackIds) {
        if (selectedSongIdSet.has(trackId)) {
          sourcePicker.toggleSelectedSong(trackId)
        }
      }
      return
    }
    for (const trackId of visibleTrackIds) {
      if (!selectedSongIdSet.has(trackId)) {
        sourcePicker.toggleSelectedSong(trackId)
      }
    }
  }

  const actionTabIndex = action.value === 'add_to_this_playlist' ? 0 : 1
  const sourceModeTabIndex = playlists.otherPlaylist.sourceMode === 'my_playlists' ? 0 : 1
  const destinationModeTabIndex = playlists.destination.mode === 'existing' ? 0 : 1

  return (
    <SurfaceCard>
      <SectionEyebrow>Merging</SectionEyebrow>
      <h3 className="mt-2 text-2xl font-semibold text-[rgb(var(--votuna-ink))]">Copy songs between playlists</h3>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
              What do you want to do?
            </p>
            <TabGroup
              index={actionTabIndex}
              onIndexChange={(index) =>
                action.setValue(index === 0 ? 'add_to_this_playlist' : 'copy_to_another_playlist')
              }
            >
              <TabList variant="solid" className="mt-3">
                <Tab className="border border-[color:rgb(var(--votuna-ink)/0.22)] data-[selected]:border-[rgb(var(--votuna-accent))]">
                  Add songs to this playlist
                </Tab>
                <Tab className="border border-[color:rgb(var(--votuna-ink)/0.22)] data-[selected]:border-[rgb(var(--votuna-accent))]">
                  Copy songs to another playlist
                </Tab>
              </TabList>
            </TabGroup>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
              Choose playlists
            </p>

            {action.value === 'add_to_this_playlist' ? (
              <div className="mt-3 space-y-4">
                <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.65)]">
                  Pick the playlist to copy songs from.
                </p>
                <TabGroup
                  index={sourceModeTabIndex}
                  onIndexChange={(index) =>
                    playlists.otherPlaylist.setSourceMode(index === 0 ? 'my_playlists' : 'search_playlists')
                  }
                >
                  <TabList variant="solid">
                    <Tab>My playlists</Tab>
                    <Tab>Search playlists</Tab>
                  </TabList>
                </TabGroup>

                {playlists.otherPlaylist.sourceMode === 'search_playlists' ? (
                  <div className="space-y-2">
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        if (
                          playlists.otherPlaylist.search.isPending ||
                          !playlists.otherPlaylist.search.input.trim()
                        ) {
                          return
                        }
                        playlists.otherPlaylist.search.run()
                      }}
                    >
                      <ClearableInput
                        value={playlists.otherPlaylist.search.input}
                        onValueChange={playlists.otherPlaylist.search.setInput}
                        containerClassName="flex-1"
                        placeholder="Search playlists or paste a playlist link"
                        clearAriaLabel="Clear playlist search"
                      />
                      <AppButton
                        intent="secondary"
                        type="submit"
                        disabled={
                          playlists.otherPlaylist.search.isPending ||
                          !playlists.otherPlaylist.search.input.trim()
                        }
                      >
                        {playlists.otherPlaylist.search.isPending ? 'Searching...' : 'Search'}
                      </AppButton>
                    </form>
                    <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.58)]">
                      Enter playlist text to search, or paste a playlist URL.
                    </p>
                    {playlists.otherPlaylist.search.status ? (
                      <StatusCallout tone="error" title="Search status" className="mt-2">
                        {playlists.otherPlaylist.search.status}
                      </StatusCallout>
                    ) : null}
                  </div>
                ) : null}

                <PlaylistGridPicker
                  options={playlists.otherPlaylist.options}
                  selectedKey={playlists.otherPlaylist.selectedKey}
                  onSelect={playlists.otherPlaylist.setSelectedKey}
                  emptyMessage={
                    playlists.otherPlaylist.sourceMode === 'search_playlists'
                      ? 'Search playlists above to choose a source playlist.'
                      : 'No eligible playlists found yet. Create or sync another playlist first.'
                  }
                />
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <TabGroup
                  index={destinationModeTabIndex}
                  onIndexChange={(index) =>
                    playlists.destination.setMode(index === 0 ? 'existing' : 'create')
                  }
                >
                  <TabList variant="solid">
                    <Tab>Existing playlist</Tab>
                    <Tab>Create new playlist</Tab>
                  </TabList>
                </TabGroup>

                {!playlists.destination.isCreatingNew ? (
                  <div>
                    <p className="mb-2 text-sm text-[color:rgb(var(--votuna-ink)/0.65)]">
                      Pick the destination playlist.
                    </p>
                    <PlaylistGridPicker
                      options={playlists.otherPlaylist.options}
                      selectedKey={playlists.otherPlaylist.selectedKey}
                      onSelect={playlists.otherPlaylist.setSelectedKey}
                      emptyMessage="No eligible playlists found yet. Create or sync another playlist first."
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
                        New playlist name
                      </p>
                      <ClearableInput
                        value={playlists.destination.createForm.title}
                        onValueChange={playlists.destination.createForm.setTitle}
                        className="mt-2"
                        placeholder="Playlist name"
                        clearAriaLabel="Clear playlist name"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
                        Description
                      </p>
                      <ClearableInput
                        value={playlists.destination.createForm.description}
                        onValueChange={playlists.destination.createForm.setDescription}
                        className="mt-2"
                        placeholder="Optional description"
                        clearAriaLabel="Clear playlist description"
                      />
                    </div>
                    <label className="flex items-center gap-3 text-sm text-[color:rgb(var(--votuna-ink)/0.75)] sm:col-span-2">
                      <Switch
                        checked={playlists.destination.createForm.isPublic}
                        onChange={playlists.destination.createForm.setIsPublic}
                      />
                      Create as public playlist
                    </label>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
              Choose songs
            </p>
            {!steps.canProceedFromPlaylists ? (
              <StatusCallout tone="info" title="Selection required" className="mt-3">
                Choose playlists first to load song options.
              </StatusCallout>
            ) : (
              <div className="mt-3 space-y-4">
                <Select
                  value={songScope.value}
                  onValueChange={(value) => songScope.setValue(value as typeof songScope.value)}
                >
                  {SONG_SCOPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </Select>

                {songScope.value === 'genre' ? (
                  <FacetSelector
                    label="Genres"
                    customPlaceholder="Add a genre (example: house)"
                    selectedValues={songScope.genre.selectedValues}
                    suggestions={songScope.genre.suggestions}
                    customInput={songScope.genre.customInput}
                    onCustomInputChange={songScope.genre.setCustomInput}
                    onAddCustomValue={songScope.genre.addCustomValue}
                    onToggleSuggestion={songScope.genre.toggleSuggestion}
                    onRemoveValue={songScope.genre.removeValue}
                    isLoading={songScope.genre.isLoading}
                    status={songScope.genre.status}
                  />
                ) : null}

                {songScope.value === 'artist' ? (
                  <FacetSelector
                    label="Artists"
                    customPlaceholder="Add an artist (example: DJ Seinfeld)"
                    selectedValues={songScope.artist.selectedValues}
                    suggestions={songScope.artist.suggestions}
                    customInput={songScope.artist.customInput}
                    onCustomInputChange={songScope.artist.setCustomInput}
                    onAddCustomValue={songScope.artist.addCustomValue}
                    onToggleSuggestion={songScope.artist.toggleSuggestion}
                    onRemoveValue={songScope.artist.removeValue}
                    isLoading={songScope.artist.isLoading}
                    status={songScope.artist.status}
                  />
                ) : null}

                {songScope.value === 'songs' ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">Pick songs</p>
                        <p className="mt-1 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                          Selected songs: {sourcePicker.selectedSongIds.length}
                        </p>
                      </div>
                      <div className="w-full max-w-sm">
                        <ClearableInput
                          value={sourcePicker.search}
                          onValueChange={sourcePicker.setSearch}
                          placeholder="Search songs in source playlist"
                          clearAriaLabel="Clear source song search"
                        />
                      </div>
                    </div>

                    {sourcePicker.status ? (
                      <StatusCallout tone="error" title="Song search status">
                        {sourcePicker.status}
                      </StatusCallout>
                    ) : null}

                    {sourcePicker.isLoading ? (
                      <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading songs...</p>
                    ) : sourcePicker.tracks.length === 0 ? (
                      <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                        No songs found for this source playlist.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <label className="inline-flex items-center gap-2 text-xs text-[color:rgb(var(--votuna-ink)/0.62)]">
                          <input
                            type="checkbox"
                            checked={allVisibleTracksSelected}
                            onChange={toggleVisibleTracksSelection}
                          />
                          {allVisibleTracksSelected ? 'Unselect all on this page' : 'Select all on this page'}
                        </label>
                        {sourcePicker.tracks.map((track) => (
                          <label
                            key={track.provider_track_id}
                            className="flex items-center gap-3 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)] px-4 py-3 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSongIdSet.has(track.provider_track_id)}
                              onChange={() => sourcePicker.toggleSelectedSong(track.provider_track_id)}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[rgb(var(--votuna-ink))]">
                                {track.title}
                              </p>
                              <p className="truncate text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                                {track.artist || 'Unknown artist'}
                                {track.genre ? ` - ${track.genre}` : ''}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.56)]">
                        Showing {rangeStart}-{rangeEnd} of {sourceTrackTotalCount}
                      </p>
                      <div className="flex gap-2">
                        <AppButton
                          intent="ghost"
                          size="xs"
                          disabled={!canPageBack}
                          onClick={() =>
                            setSourceTrackOffset(Math.max(0, sourceTrackOffset - sourceTrackLimit))
                          }
                        >
                          Previous
                        </AppButton>
                        <AppButton
                          intent="ghost"
                          size="xs"
                          disabled={!canPageForward}
                          onClick={() => setSourceTrackOffset(nextOffset)}
                        >
                          Next
                        </AppButton>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Card>
        </div>

        <div>
          <ReviewRunPanel
            sourceLabel={playlists.sourceLabel}
            destinationLabel={playlists.destinationLabel}
            review={management.review}
          />
        </div>
      </div>
    </SurfaceCard>
  )
}
