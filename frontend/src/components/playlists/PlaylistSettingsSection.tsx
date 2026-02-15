import { Dialog, DialogPanel, NumberInput, Switch } from '@tremor/react'
import { useState } from 'react'

import AppButton from '@/components/ui/AppButton'
import PrimaryButton from '@/components/ui/PrimaryButton'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import StatusCallout from '@/components/ui/StatusCallout'
import SurfaceCard from '@/components/ui/SurfaceCard'

type PlaylistSettingsSectionProps = {
  requiredVotePercent: number
  tieBreakMode: 'add' | 'reject'
  playlistType: 'personal' | 'collaborative'
  collaboratorCount: number
  canEditSettings: boolean
  isSaving: boolean
  isSwitchingToPersonal: boolean
  settingsStatus: string
  onSaveSettings: () => void
  onSwitchToPersonal: () => void
  onRequiredVotePercentChange: (value: number) => void
  onTieBreakModeChange: (value: 'add' | 'reject') => void
}

export default function PlaylistSettingsSection({
  requiredVotePercent,
  tieBreakMode,
  playlistType,
  collaboratorCount,
  canEditSettings,
  isSaving,
  isSwitchingToPersonal,
  settingsStatus,
  onSaveSettings,
  onSwitchToPersonal,
  onRequiredVotePercentChange,
  onTieBreakModeChange,
}: PlaylistSettingsSectionProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const isCollaborative = playlistType === 'collaborative'
  const isAddOnTie = tieBreakMode === 'add'
  const canEditVoting = canEditSettings && isCollaborative

  return (
    <SurfaceCard>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <SectionEyebrow>Settings</SectionEyebrow>
          <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
            Configure playlist type and song addition behavior.
          </p>
        </div>
        <PrimaryButton onClick={onSaveSettings} disabled={isSaving || !canEditVoting}>
          {isSaving ? 'Saving...' : 'Save settings'}
        </PrimaryButton>
      </div>
      <div className="mt-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
            Playlist type
          </p>
          <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
            Current: <span className="font-medium">{isCollaborative ? 'Collaborative' : 'Personal'}</span>
            {isCollaborative ? ` (${collaboratorCount} collaborator${collaboratorCount === 1 ? '' : 's'})` : ''}
          </p>
          <p className="mt-1 text-xs text-[color:rgb(var(--votuna-ink)/0.55)]">
            Collaborative mode turns on automatically when someone joins.
          </p>
          {isCollaborative ? (
            <div className="mt-3">
              <StatusCallout tone="warning" title="One-way action">
                Switching to personal will remove all collaborators, revoke outstanding invites, and delete pending
                suggestions.
              </StatusCallout>
              <div className="mt-3">
                <AppButton
                  intent="secondary"
                  disabled={!canEditSettings || isSwitchingToPersonal}
                  onClick={() => setIsConfirmOpen(true)}
                >
                  {isSwitchingToPersonal ? 'Switching...' : 'Switch to personal'}
                </AppButton>
              </div>
            </div>
          ) : (
            <StatusCallout tone="info" title="Personal playlist" className="mt-3">
              This playlist is already personal.
            </StatusCallout>
          )}
        </div>

        <StatusCallout tone="info" title="Voting settings">
          Voting settings are only used for collaborative playlists.
        </StatusCallout>

        <div className="space-y-4 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)] p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
              Tie-break mode
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-[color:rgb(var(--votuna-ink)/0.65)]">Reject on tie</span>
              <Switch
                checked={isAddOnTie}
                disabled={!canEditVoting}
                onChange={(checked) => onTieBreakModeChange(checked ? 'add' : 'reject')}
              />
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
            <NumberInput
              min={1}
              max={100}
              value={requiredVotePercent}
              disabled={!canEditVoting}
              enableStepper
              className="mt-2"
              onValueChange={(value) => {
                if (!Number.isFinite(value)) return
                onRequiredVotePercentChange(value)
              }}
            />
          </div>
        </div>
      </div>

      {settingsStatus ? (
        <StatusCallout tone="info" title="Settings status" className="mt-4">
          {settingsStatus}
        </StatusCallout>
      ) : null}
      {!canEditSettings ? (
        <StatusCallout tone="warning" title="Permission required" className="mt-2">
          Only the playlist owner can edit these settings.
        </StatusCallout>
      ) : null}
      <Dialog
        open={isConfirmOpen}
        onClose={() => {
          if (isSwitchingToPersonal) return
          setIsConfirmOpen(false)
        }}
      >
        <DialogPanel className="w-full max-w-lg p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Are you sure?</p>
          <h3 className="mt-2 text-xl font-semibold text-[rgb(var(--votuna-ink))]">Switch to personal playlist</h3>
          <p className="mt-3 text-sm text-[color:rgb(var(--votuna-ink)/0.72)]">This action will:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[color:rgb(var(--votuna-ink)/0.72)]">
            <li>Remove all collaborators</li>
            <li>Revoke outstanding invites</li>
            <li>Delete all pending suggestions</li>
          </ul>
          <p className="mt-3 text-sm text-amber-700">
            Collaborative mode turns back on automatically when someone joins again.
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <AppButton
              intent="ghost"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSwitchingToPersonal}
            >
              Cancel
            </AppButton>
            <AppButton
              intent="danger"
              onClick={() => {
                onSwitchToPersonal()
                setIsConfirmOpen(false)
              }}
              disabled={isSwitchingToPersonal}
            >
              {isSwitchingToPersonal ? 'Switching...' : 'Yes, switch to personal'}
            </AppButton>
          </div>
        </DialogPanel>
      </Dialog>
    </SurfaceCard>
  )
}
