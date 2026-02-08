import PrimaryButton from '@/components/ui/PrimaryButton'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'

type PlaylistSettingsSectionProps = {
  requiredVotePercent: number
  tieBreakMode: 'add' | 'reject'
  canEditSettings: boolean
  isSaving: boolean
  settingsStatus: string
  onSaveSettings: () => void
  onRequiredVotePercentChange: (value: number) => void
  onTieBreakModeChange: (value: 'add' | 'reject') => void
}

export default function PlaylistSettingsSection({
  requiredVotePercent,
  tieBreakMode,
  canEditSettings,
  isSaving,
  settingsStatus,
  onSaveSettings,
  onRequiredVotePercentChange,
  onTieBreakModeChange,
}: PlaylistSettingsSectionProps) {
  const isAddOnTie = tieBreakMode === 'add'

  return (
    <SurfaceCard>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <SectionEyebrow>Settings</SectionEyebrow>
          <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
            Votes required to add a track automatically.
          </p>
        </div>
        <PrimaryButton onClick={onSaveSettings} disabled={isSaving || !canEditSettings}>
          {isSaving ? 'Saving...' : 'Save settings'}
        </PrimaryButton>
      </div>
      <div className="mt-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
              Tie-break mode
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-[color:rgb(var(--votuna-ink)/0.65)]">Reject on tie</span>
              <button
                type="button"
                role="switch"
                aria-checked={isAddOnTie}
                aria-label="Toggle tie-break mode"
                disabled={!canEditSettings}
                onClick={() => onTieBreakModeChange(isAddOnTie ? 'reject' : 'add')}
                className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                  isAddOnTie
                    ? 'border-emerald-300 bg-emerald-100/80'
                    : 'border-[color:rgb(var(--votuna-ink)/0.2)] bg-[rgba(var(--votuna-paper),0.9)]'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    isAddOnTie ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-[color:rgb(var(--votuna-ink)/0.65)]">Add on tie</span>
            </div>
            <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
              Current mode: <span className="font-medium">{isAddOnTie ? 'Add on tie' : 'Reject on tie'}</span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
              Required vote percent
            </p>
            <input
              type="number"
              min={1}
              max={100}
              value={requiredVotePercent}
              disabled={!canEditSettings}
              onChange={(event) => onRequiredVotePercentChange(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.9)] px-4 py-2 text-sm text-[rgb(var(--votuna-ink))] disabled:opacity-60"
            />
          </div>
        </div>
      </div>
      {settingsStatus ? (
        <p className="mt-4 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">{settingsStatus}</p>
      ) : null}
      {!canEditSettings ? (
        <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.5)]">
          Only the playlist owner can edit these settings.
        </p>
      ) : null}
    </SurfaceCard>
  )
}
