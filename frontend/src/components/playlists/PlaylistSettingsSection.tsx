import PrimaryButton from '@/components/ui/PrimaryButton'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'

type PlaylistSettingsSectionProps = {
  requiredVotePercent: number
  autoAddOnThreshold: boolean
  canEditSettings: boolean
  isSaving: boolean
  settingsStatus: string
  onSaveSettings: () => void
  onRequiredVotePercentChange: (value: number) => void
  onAutoAddOnThresholdChange: (value: boolean) => void
}

export default function PlaylistSettingsSection({
  requiredVotePercent,
  autoAddOnThreshold,
  canEditSettings,
  isSaving,
  settingsStatus,
  onSaveSettings,
  onRequiredVotePercentChange,
  onAutoAddOnThresholdChange,
}: PlaylistSettingsSectionProps) {
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
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
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
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
            Auto-add on threshold
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={autoAddOnThreshold}
            onClick={() => {
              if (!canEditSettings) return
              onAutoAddOnThresholdChange(!autoAddOnThreshold)
            }}
            className={`mt-3 inline-flex h-7 w-12 items-center rounded-full border transition ${
              autoAddOnThreshold
                ? 'border-transparent bg-[rgb(var(--votuna-accent))]'
                : 'border-[color:rgb(var(--votuna-ink)/0.2)] bg-[rgba(var(--votuna-paper),0.8)]'
            } ${canEditSettings ? '' : 'opacity-60'}`}
            disabled={!canEditSettings}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-[rgb(var(--votuna-paper))] shadow transition ${
                autoAddOnThreshold ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
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
