import { Dialog, DialogPanel, NumberInput, Subtitle, Switch, Text } from '@tremor/react'
import { useState } from 'react'

import AppButton from '@/components/ui/AppButton'
import AppPanelRow from '@/components/ui/AppPanelRow'
import AppSectionHeader from '@/components/ui/AppSectionHeader'
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
      <AppSectionHeader
        eyebrow="Settings"
        description="Configure playlist type and song addition behavior."
        actions={
          <AppButton intent="primary" onClick={onSaveSettings} disabled={isSaving || !canEditVoting}>
            {isSaving ? 'Saving...' : 'Save settings'}
          </AppButton>
        }
        className="items-center"
      />
      <div className="mt-6 space-y-4">
        <div>
          <SectionEyebrow compact>Playlist type</SectionEyebrow>
          <Text className="mt-2 text-xs">
            Current: <span className="font-medium">{isCollaborative ? 'Collaborative' : 'Personal'}</span>
            {isCollaborative ? ` (${collaboratorCount} collaborator${collaboratorCount === 1 ? '' : 's'})` : ''}
          </Text>
          <Text className="mt-1 text-xs">
            Collaborative mode turns on automatically when someone joins.
          </Text>
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

        <AppPanelRow className="space-y-4 p-4">
          <div>
            <SectionEyebrow compact>Tie-break mode</SectionEyebrow>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-[color:rgb(var(--votuna-ink)/0.65)]">Reject on tie</span>
              <Switch
                checked={isAddOnTie}
                disabled={!canEditVoting}
                onChange={(checked) => onTieBreakModeChange(checked ? 'add' : 'reject')}
              />
              <span className="text-sm text-[color:rgb(var(--votuna-ink)/0.65)]">Add on tie</span>
            </div>
            <Text className="mt-2 text-xs">
              Current mode: <span className="font-medium">{isAddOnTie ? 'Add on tie' : 'Reject on tie'}</span>
            </Text>
          </div>

          <div>
            <SectionEyebrow compact>Required vote percent</SectionEyebrow>
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
        </AppPanelRow>
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
          <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Are you sure?</Text>
          <h3 className="mt-2 text-xl font-semibold text-[rgb(var(--votuna-ink))]">Switch to personal playlist</h3>
          <Subtitle className="mt-3">
            This action will:
          </Subtitle>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[color:rgb(var(--votuna-ink)/0.72)]">
            <li>Remove all collaborators</li>
            <li>Revoke outstanding invites</li>
            <li>Delete all pending suggestions</li>
          </ul>
          <Text className="mt-3 text-sm text-amber-700">
            Collaborative mode turns back on automatically when someone joins again.
          </Text>
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
