import { Card, Col, Grid, Select, SelectItem, Switch, Tab, TabGroup, TabList, Text } from '@tremor/react'

import AppButton from '@/components/ui/AppButton'
import AppPanelRow from '@/components/ui/AppPanelRow'
import AppSectionHeader from '@/components/ui/AppSectionHeader'
import ClearableTextInput from '@/components/ui/ClearableTextInput'
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
const TAB_BUTTON_CLASS =
  'border border-[color:rgb(var(--votuna-ink)/0.22)] data-[selected]:border-[rgb(var(--votuna-accent))]'

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
      <AppSectionHeader eyebrow="Merging" title="Copy songs between playlists" />

      <Grid className="mt-6 gap-6" numItems={1} numItemsLg={3}>
        <Col numColSpanLg={2} className="space-y-5">
          <Card className="p-5">
            <SectionEyebrow compact tone="strong">
              What do you want to do?
            </SectionEyebrow>
            <TabGroup
              index={actionTabIndex}
              onIndexChange={(index) =>
                action.setValue(index === 0 ? 'add_to_this_playlist' : 'copy_to_another_playlist')
              }
            >
              <TabList variant="solid" className="mt-3">
                <Tab className={TAB_BUTTON_CLASS}>
                  Add songs to this playlist
                </Tab>
                <Tab className={TAB_BUTTON_CLASS}>
                  Copy songs to another playlist
                </Tab>
              </TabList>
            </TabGroup>
          </Card>

          <Card className="p-5">
            <SectionEyebrow compact tone="strong">
              Choose playlists
            </SectionEyebrow>

            {action.value === 'add_to_this_playlist' ? (
              <div className="mt-3 space-y-4">
                <Text>
                  Pick the playlist to copy songs from.
                </Text>
                <TabGroup
                  index={sourceModeTabIndex}
                  onIndexChange={(index) =>
                    playlists.otherPlaylist.setSourceMode(index === 0 ? 'my_playlists' : 'search_playlists')
                  }
                >
                  <TabList variant="solid">
                    <Tab className={TAB_BUTTON_CLASS}>My playlists</Tab>
                    <Tab className={TAB_BUTTON_CLASS}>Search playlists</Tab>
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
                      <ClearableTextInput
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
                    <Text className="text-xs">
                      Enter playlist text to search, or paste a playlist URL.
                    </Text>
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
                    <Tab className={TAB_BUTTON_CLASS}>Existing playlist</Tab>
                    <Tab className={TAB_BUTTON_CLASS}>Create new playlist</Tab>
                  </TabList>
                </TabGroup>

                {!playlists.destination.isCreatingNew ? (
                  <div>
                    <Text className="mb-2">
                      Pick the destination playlist.
                    </Text>
                    <PlaylistGridPicker
                      options={playlists.otherPlaylist.options}
                      selectedKey={playlists.otherPlaylist.selectedKey}
                      onSelect={playlists.otherPlaylist.setSelectedKey}
                      emptyMessage="No eligible playlists found yet. Create or sync another playlist first."
                    />
                  </div>
                ) : (
                  <Grid className="gap-4" numItems={1} numItemsSm={2}>
                    <div>
                      <SectionEyebrow compact tone="strong">
                        New playlist name
                      </SectionEyebrow>
                      <ClearableTextInput
                        value={playlists.destination.createForm.title}
                        onValueChange={playlists.destination.createForm.setTitle}
                        className="mt-2"
                        placeholder="Playlist name"
                        clearAriaLabel="Clear playlist name"
                      />
                    </div>
                    <div>
                      <SectionEyebrow compact tone="strong">
                        Description
                      </SectionEyebrow>
                      <ClearableTextInput
                        value={playlists.destination.createForm.description}
                        onValueChange={playlists.destination.createForm.setDescription}
                        className="mt-2"
                        placeholder="Optional description"
                        clearAriaLabel="Clear playlist description"
                      />
                    </div>
                    <Col numColSpanSm={2}>
                      <label className="flex items-center gap-3 text-sm text-[color:rgb(var(--votuna-ink)/0.75)]">
                        <Switch
                          checked={playlists.destination.createForm.isPublic}
                          onChange={playlists.destination.createForm.setIsPublic}
                        />
                        Create as public playlist
                      </label>
                    </Col>
                  </Grid>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <SectionEyebrow compact tone="strong">
              Choose songs
            </SectionEyebrow>
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
                        <Text className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">Pick songs</Text>
                        <Text className="mt-1 text-xs">
                          Selected songs: {sourcePicker.selectedSongIds.length}
                        </Text>
                      </div>
                      <div className="w-full max-w-sm">
                        <ClearableTextInput
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
                      <Text>Loading songs...</Text>
                    ) : sourcePicker.tracks.length === 0 ? (
                      <Text>No songs found for this source playlist.</Text>
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
                          <label key={track.provider_track_id} className="block">
                            <AppPanelRow className="flex items-center gap-3 text-sm">
                              <input
                                type="checkbox"
                                checked={selectedSongIdSet.has(track.provider_track_id)}
                                onChange={() => sourcePicker.toggleSelectedSong(track.provider_track_id)}
                              />
                              <div className="min-w-0">
                                <Text className="truncate font-semibold text-[rgb(var(--votuna-ink))]">
                                  {track.title}
                                </Text>
                                <Text className="truncate text-xs">
                                  {track.artist || 'Unknown artist'}
                                  {track.genre ? ` - ${track.genre}` : ''}
                                </Text>
                              </div>
                            </AppPanelRow>
                          </label>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Text className="text-xs">
                        Showing {rangeStart}-{rangeEnd} of {sourceTrackTotalCount}
                      </Text>
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
        </Col>

        <Col numColSpanLg={1}>
          <ReviewRunPanel
            sourceLabel={playlists.sourceLabel}
            destinationLabel={playlists.destinationLabel}
            review={management.review}
          />
        </Col>
      </Grid>
    </SurfaceCard>
  )
}
