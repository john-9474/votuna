import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'
import type { PlaylistManagementState } from '@/lib/hooks/playlistDetail/usePlaylistManagement'
import ClearableInput from '@/components/ui/ClearableInput'

import FacetSelector from './FacetSelector'
import PlaylistGridPicker from './PlaylistGridPicker'
import ReviewRunPanel from './ReviewRunPanel'

type MergingBulkEditingSectionProps = {
  management: PlaylistManagementState
}

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

  return (
    <SurfaceCard>
      <SectionEyebrow>Merging</SectionEyebrow>
      <div className="mt-2">
        <h3 className="text-2xl font-semibold text-[rgb(var(--votuna-ink))]">
          Copy songs between playlists
        </h3>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
              What do you want to do?
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => action.setValue('add_to_this_playlist')}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                  action.value === 'add_to_this_playlist'
                    ? 'border-transparent bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))]'
                    : 'border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.85)] text-[rgb(var(--votuna-ink))]'
                }`}
              >
                Add songs to this playlist
              </button>
              <button
                type="button"
                onClick={() => action.setValue('copy_to_another_playlist')}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                  action.value === 'copy_to_another_playlist'
                    ? 'border-transparent bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))]'
                    : 'border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.85)] text-[rgb(var(--votuna-ink))]'
                }`}
              >
                Copy songs to another playlist
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
              Choose playlists
            </p>

            {action.value === 'add_to_this_playlist' ? (
              <div className="mt-3 space-y-4">
                <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.65)]">
                  Pick the playlist to copy songs from.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => playlists.otherPlaylist.setSourceMode('my_playlists')}
                    className={`rounded-full px-4 py-2 text-xs font-semibold ${
                      playlists.otherPlaylist.sourceMode === 'my_playlists'
                        ? 'bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))]'
                        : 'border border-[color:rgb(var(--votuna-ink)/0.14)]'
                    }`}
                  >
                    My playlists
                  </button>
                  <button
                    type="button"
                    onClick={() => playlists.otherPlaylist.setSourceMode('search_playlists')}
                    className={`rounded-full px-4 py-2 text-xs font-semibold ${
                      playlists.otherPlaylist.sourceMode === 'search_playlists'
                        ? 'bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))]'
                        : 'border border-[color:rgb(var(--votuna-ink)/0.14)]'
                    }`}
                  >
                    Search playlists
                  </button>
                </div>

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
                        className="rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm"
                        placeholder="Search playlists or paste a SoundCloud playlist link"
                        clearAriaLabel="Clear playlist search"
                      />
                      <button
                        type="submit"
                        disabled={
                          playlists.otherPlaylist.search.isPending ||
                          !playlists.otherPlaylist.search.input.trim()
                        }
                        className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.14)] px-4 py-2 text-xs font-semibold disabled:opacity-60"
                      >
                        {playlists.otherPlaylist.search.isPending ? 'Searching...' : 'Search'}
                      </button>
                    </form>
                    <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.58)]">
                      Enter playlist text to search, or paste a SoundCloud playlist URL.
                    </p>
                    {playlists.otherPlaylist.search.status ? (
                      <p className="text-xs text-rose-500">{playlists.otherPlaylist.search.status}</p>
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => playlists.destination.setMode('existing')}
                    className={`rounded-full px-4 py-2 text-xs font-semibold ${
                      playlists.destination.mode === 'existing'
                        ? 'bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))]'
                        : 'border border-[color:rgb(var(--votuna-ink)/0.14)]'
                    }`}
                  >
                    Existing playlist
                  </button>
                  <button
                    type="button"
                    onClick={() => playlists.destination.setMode('create')}
                    className={`rounded-full px-4 py-2 text-xs font-semibold ${
                      playlists.destination.mode === 'create'
                        ? 'bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))]'
                        : 'border border-[color:rgb(var(--votuna-ink)/0.14)]'
                    }`}
                  >
                    Create new playlist
                  </button>
                </div>

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
                        className="mt-2 w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm"
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
                        className="mt-2 w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm"
                        placeholder="Optional description"
                        clearAriaLabel="Clear playlist description"
                      />
                    </div>
                    <label className="flex items-center gap-3 text-sm text-[color:rgb(var(--votuna-ink)/0.75)] sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={playlists.destination.createForm.isPublic}
                        onChange={(event) =>
                          playlists.destination.createForm.setIsPublic(event.target.checked)
                        }
                      />
                      Create as public playlist
                    </label>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.82)] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
              Choose songs
            </p>
            {!steps.canProceedFromPlaylists ? (
              <p className="mt-3 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                Choose playlists first to load song options.
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                <select
                  value={songScope.value}
                  onChange={(event) => songScope.setValue(event.target.value as typeof songScope.value)}
                  className="votuna-select w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm text-[rgb(var(--votuna-ink))]"
                >
                  <option value="all">All songs</option>
                  <option value="genre">Only specific genres</option>
                  <option value="artist">Only specific artists</option>
                  <option value="songs">Pick songs manually</option>
                </select>

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
                          className="w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm"
                          placeholder="Search songs in source playlist"
                          clearAriaLabel="Clear source song search"
                        />
                      </div>
                    </div>

                    {sourcePicker.status ? (
                      <p className="text-xs text-rose-500">{sourcePicker.status}</p>
                    ) : null}

                    {sourcePicker.isLoading ? (
                      <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading songs...</p>
                    ) : sourcePicker.tracks.length === 0 ? (
                      <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
                        No songs found for this source playlist.
                      </p>
                    ) : (
                      <div className="space-y-2">
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
                        <button
                          type="button"
                          disabled={!canPageBack}
                          onClick={() =>
                            setSourceTrackOffset(Math.max(0, sourceTrackOffset - sourceTrackLimit))
                          }
                          className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.14)] px-3 py-1 text-xs disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={!canPageForward}
                          onClick={() => setSourceTrackOffset(nextOffset)}
                          className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.14)] px-3 py-1 text-xs disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
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
