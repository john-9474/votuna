import { useMemo } from 'react'
import { Text } from '@tremor/react'

import AppButton from '@/components/ui/AppButton'
import AppPanelRow from '@/components/ui/AppPanelRow'
import AppSectionHeader from '@/components/ui/AppSectionHeader'
import StatusCallout from '@/components/ui/StatusCallout'
import SurfaceCard from '@/components/ui/SurfaceCard'
import type { PlaylistManagementState } from '@/lib/hooks/playlistDetail/usePlaylistManagement'

type SoundCloudPremiumCleanupSectionProps = {
  premiumCleanup: PlaylistManagementState['premiumCleanup']
}

export default function SoundCloudPremiumCleanupSection({
  premiumCleanup,
}: SoundCloudPremiumCleanupSectionProps) {
  const statusTone = useMemo(() => {
    if (!premiumCleanup.statusMessage) return null
    if (!premiumCleanup.result) return 'error'
    return premiumCleanup.result.removed_count > 0 ? 'success' : 'info'
  }, [premiumCleanup.result, premiumCleanup.statusMessage])

  if (!premiumCleanup.isAvailable) {
    return null
  }

  const runCleanup = () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Remove all SoundCloud Go+ preview-only songs from this playlist?',
      )
      if (!confirmed) return
    }
    premiumCleanup.run()
  }

  return (
    <SurfaceCard>
      <AppSectionHeader
        eyebrow="Cleanup"
        title="Remove premium songs"
        description="Remove all SoundCloud Go+ preview-only songs from the current playlist."
        actions={
          <AppButton
            intent="danger"
            onClick={runCleanup}
            disabled={premiumCleanup.isRunning}
          >
            {premiumCleanup.isRunning ? 'Removing...' : 'Remove premium songs'}
          </AppButton>
        }
      />

      <StatusCallout tone="warning" title="Before you remove" className="mt-4">
        This removes every SoundCloud Go+ preview-only occurrence from the playlist and cannot be undone automatically.
      </StatusCallout>

      {statusTone ? (
        <StatusCallout tone={statusTone} title="Premium cleanup status" className="mt-3">
          {premiumCleanup.statusMessage}
        </StatusCallout>
      ) : null}

      {premiumCleanup.result ? (
        <AppPanelRow className="mt-3 p-4">
          <Text className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">Last cleanup result</Text>
          <div className="mt-2 grid gap-2 text-xs text-[color:rgb(var(--votuna-ink)/0.65)] sm:grid-cols-2">
            <Text>Premium songs found: {premiumCleanup.result.matched_count}</Text>
            <Text>Removed songs: {premiumCleanup.result.removed_count}</Text>
            <Text>Could not remove: {premiumCleanup.result.failed_count}</Text>
            <Text>Provider: {premiumCleanup.result.provider}</Text>
          </div>
        </AppPanelRow>
      ) : null}
    </SurfaceCard>
  )
}
