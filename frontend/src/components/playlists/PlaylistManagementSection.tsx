import type { PlaylistManagementState } from '@/lib/hooks/playlistDetail/usePlaylistManagement'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'

type PlaylistManagementSectionProps = {
  management: PlaylistManagementState
}

const SAMPLE_LIMIT = 5

export default function PlaylistManagementSection({ management }: PlaylistManagementSectionProps) {
  const { permissions, builder, sourcePicker, preview, execute, actions } = management
  const {
    direction,
    setDirection,
    exportTargetMode,
    setExportTargetMode,
    isCreatingDestination,
    counterpartyOptions,
    selectedCounterpartyKey,
    setSelectedCounterpartyKey,
    destinationCreate,
    selection,
  } = builder
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

  if (!permissions.canManage) {
    return (
      <SurfaceCard>
        <SectionEyebrow>Manage</SectionEyebrow>
        <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
          Playlist management actions are owner-only. Ask the owner to run import/export operations.
        </p>
      </SurfaceCard>
    )
  }

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <SectionEyebrow>Manage</SectionEyebrow>
            <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--votuna-ink))]">
              Playlist management
            </h2>
            <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
              Copy tracks between playlists with preview-first execution.
            </p>
          </div>
          <PrimaryButton onClick={actions.applyMergePreset}>Merge into current</PrimaryButton>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
              Direction
            </p>
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value as typeof direction)}
              className="mt-2 w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm"
            >
              <option value="import_to_current">Import into current playlist</option>
              <option value="export_from_current">Export from current playlist</option>
            </select>
          </div>

          {direction === 'export_from_current' ? (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
                Destination mode
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExportTargetMode('existing')}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    exportTargetMode === 'existing'
                      ? 'bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))]'
                      : 'border border-[color:rgb(var(--votuna-ink)/0.14)]'
                  }`}
                >
                  Existing
                </button>
                <button
                  type="button"
                  onClick={() => setExportTargetMode('create')}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    exportTargetMode === 'create'
                      ? 'bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))]'
                      : 'border border-[color:rgb(var(--votuna-ink)/0.14)]'
                  }`}
                >
                  Create new
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {!isCreatingDestination ? (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
              Counterparty playlist
            </p>
            <select
              value={selectedCounterpartyKey}
              onChange={(event) => setSelectedCounterpartyKey(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm"
            >
              <option value="">Select a playlist</option>
              {counterpartyOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} - {option.detail}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
                New playlist title
              </p>
              <input
                value={destinationCreate.title}
                onChange={(event) => destinationCreate.setTitle(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm"
                placeholder="Playlist title"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
                Description
              </p>
              <input
                value={destinationCreate.description}
                onChange={(event) => destinationCreate.setDescription(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm"
                placeholder="Optional description"
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-[color:rgb(var(--votuna-ink)/0.75)] sm:col-span-2">
              <input
                type="checkbox"
                checked={destinationCreate.isPublic}
                onChange={(event) => destinationCreate.setIsPublic(event.target.checked)}
              />
              Create as public playlist
            </label>
          </div>
        )}

        <div className="mt-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
            Selection mode
          </p>
          <select
            value={selection.mode}
            onChange={(event) => selection.setMode(event.target.value as typeof selection.mode)}
            className="mt-2 w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm"
          >
            <option value="all">All tracks</option>
            <option value="genre">By genre</option>
            <option value="artist">By artist</option>
            <option value="songs">Specific songs</option>
          </select>
        </div>

        {selection.mode === 'genre' || selection.mode === 'artist' ? (
          <div className="mt-4">
            <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
              Enter comma-separated values (case-insensitive exact matching).
            </p>
            <input
              value={selection.valuesInput}
              onChange={(event) => selection.setValuesInput(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm"
              placeholder={selection.mode === 'genre' ? 'house, ukg' : 'artist one, artist two'}
            />
          </div>
        ) : null}
      </SurfaceCard>

      {selection.mode === 'songs' ? (
        <SurfaceCard>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionEyebrow>Source songs</SectionEyebrow>
              <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                Select one or more tracks to transfer.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <input
                value={sourcePicker.search}
                onChange={(event) => sourcePicker.setSearch(event.target.value)}
                className="w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm"
                placeholder="Search source tracks"
              />
            </div>
          </div>

          {sourcePicker.status ? (
            <p className="mt-3 text-xs text-rose-500">{sourcePicker.status}</p>
          ) : null}

          {sourcePicker.isLoading ? (
            <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading source tracks...</p>
          ) : sourcePicker.tracks.length === 0 ? (
            <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
              No source tracks found for this selection.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
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
                    <p className="truncate font-semibold text-[rgb(var(--votuna-ink))]">{track.title}</p>
                    <p className="truncate text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                      {track.artist || 'Unknown artist'}
                      {track.genre ? ` - ${track.genre}` : ''}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
              Showing {sourceTrackOffset + 1}-
              {Math.min(sourceTrackOffset + sourceTrackLimit, sourceTrackTotalCount)} of{' '}
              {sourceTrackTotalCount}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canPageBack}
                onClick={() => setSourceTrackOffset(Math.max(0, sourceTrackOffset - sourceTrackLimit))}
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
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={preview.run} disabled={!preview.canRun || preview.isPending}>
            {preview.isPending ? 'Previewing...' : 'Preview transfer'}
          </PrimaryButton>
          <PrimaryButton onClick={execute.run} disabled={!execute.canRun || execute.isPending}>
            {execute.isPending ? 'Executing...' : 'Execute transfer'}
          </PrimaryButton>
        </div>

        {preview.error ? <p className="mt-3 text-xs text-rose-500">{preview.error}</p> : null}
        {execute.error ? <p className="mt-3 text-xs text-rose-500">{execute.error}</p> : null}

        {preview.data ? (
          <div className="mt-4 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.85)] p-4">
            <p className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">Preview summary</p>
            <div className="mt-2 grid gap-2 text-xs text-[color:rgb(var(--votuna-ink)/0.65)] sm:grid-cols-3">
              <p>Matched: {preview.data.matched_count}</p>
              <p>To add: {preview.data.to_add_count}</p>
              <p>Duplicates: {preview.data.duplicate_count}</p>
            </div>
            <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
              {preview.data.source.title} {'->'} {preview.data.destination.title}
            </p>
            {preview.data.matched_sample.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-semibold text-[color:rgb(var(--votuna-ink)/0.7)]">
                  Matched sample
                </p>
                <ul className="mt-1 space-y-1 text-xs text-[color:rgb(var(--votuna-ink)/0.65)]">
                  {preview.data.matched_sample.slice(0, SAMPLE_LIMIT).map((track) => (
                    <li key={`matched-${track.provider_track_id}`}>
                      {track.title} ({track.provider_track_id})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {execute.data ? (
          <div className="mt-4 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.85)] p-4">
            <p className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">Execution result</p>
            <div className="mt-2 grid gap-2 text-xs text-[color:rgb(var(--votuna-ink)/0.65)] sm:grid-cols-4">
              <p>Matched: {execute.data.matched_count}</p>
              <p>Added: {execute.data.added_count}</p>
              <p>Skipped: {execute.data.skipped_duplicate_count}</p>
              <p>Failed: {execute.data.failed_count}</p>
            </div>
            {execute.data.failed_items.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-rose-500">
                {execute.data.failed_items.slice(0, SAMPLE_LIMIT).map((item) => (
                  <li key={`failed-${item.provider_track_id}`}>
                    {item.provider_track_id}: {item.error}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </SurfaceCard>
    </div>
  )
}
