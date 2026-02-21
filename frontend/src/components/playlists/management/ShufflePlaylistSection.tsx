import { Dialog, DialogPanel, Subtitle, Text } from '@tremor/react'
import { useMemo, useState } from 'react'

import AppButton from '@/components/ui/AppButton'
import AppPanelRow from '@/components/ui/AppPanelRow'
import AppSectionHeader from '@/components/ui/AppSectionHeader'
import StatusCallout from '@/components/ui/StatusCallout'
import SurfaceCard from '@/components/ui/SurfaceCard'
import type { PlaylistManagementState } from '@/lib/hooks/playlistDetail/usePlaylistManagement'

type ShufflePlaylistSectionProps = {
  shuffle: PlaylistManagementState['shuffle']
}

export default function ShufflePlaylistSection({ shuffle }: ShufflePlaylistSectionProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const statusTone = useMemo(() => {
    if (!shuffle.statusMessage) return null
    if (!shuffle.result) return 'error'
    return shuffle.result.status === 'partial_failure' ? 'warning' : 'success'
  }, [shuffle.result, shuffle.statusMessage])

  const runShuffle = () => {
    shuffle.run()
    setIsConfirmOpen(false)
  }

  return (
    <SurfaceCard>
      <AppSectionHeader
        eyebrow="Reorder"
        title="Shuffle current playlist"
        description="Randomly reorder songs in this provider playlist. This action does not add or remove songs."
        actions={
          <AppButton
            intent="secondary"
            onClick={() => setIsConfirmOpen(true)}
            disabled={shuffle.isRunning}
          >
            {shuffle.isRunning ? 'Shuffling...' : 'Shuffle playlist'}
          </AppButton>
        }
      />

      <StatusCallout tone="warning" title="Before you shuffle" className="mt-4">
        Shuffle changes playlist order in-place and cannot be undone automatically.
      </StatusCallout>

      {statusTone ? (
        <StatusCallout
          tone={statusTone}
          title={shuffle.result?.status === 'partial_failure' ? 'Shuffle partial result' : 'Shuffle status'}
          className="mt-3"
        >
          {shuffle.statusMessage}
        </StatusCallout>
      ) : null}

      {shuffle.result ? (
        <AppPanelRow className="mt-3 p-4">
          <Text className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">Last shuffle result</Text>
          <div className="mt-2 grid gap-2 text-xs text-[color:rgb(var(--votuna-ink)/0.65)] sm:grid-cols-2">
            <Text>Total songs: {shuffle.result.total_items}</Text>
            <Text>Moved songs: {shuffle.result.moved_items}</Text>
            <Text>Max allowed: {shuffle.result.max_items}</Text>
            <Text>Provider: {shuffle.result.provider}</Text>
          </div>
        </AppPanelRow>
      ) : null}

      <Dialog
        open={isConfirmOpen}
        onClose={() => {
          if (shuffle.isRunning) return
          setIsConfirmOpen(false)
        }}
      >
        <DialogPanel className="w-full max-w-lg p-6">
          <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Confirm shuffle</Text>
          <h3 className="mt-2 text-xl font-semibold text-[rgb(var(--votuna-ink))]">Shuffle current playlist</h3>
          <Subtitle className="mt-3">
            This will reorder the songs in your current playlist using a fresh random order.
          </Subtitle>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[color:rgb(var(--votuna-ink)/0.72)]">
            <li>Only this playlist is affected</li>
            <li>Duplicate song occurrences are preserved</li>
            <li>This operation cannot be automatically rolled back</li>
          </ul>
          <div className="mt-5 flex items-center justify-end gap-2">
            <AppButton
              intent="ghost"
              onClick={() => setIsConfirmOpen(false)}
              disabled={shuffle.isRunning}
            >
              Cancel
            </AppButton>
            <AppButton intent="danger" onClick={runShuffle} disabled={shuffle.isRunning}>
              {shuffle.isRunning ? 'Shuffling...' : 'Yes, shuffle now'}
            </AppButton>
          </div>
        </DialogPanel>
      </Dialog>
    </SurfaceCard>
  )
}
