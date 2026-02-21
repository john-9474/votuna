import type { PlaylistManagementState } from '@/lib/hooks/playlistDetail/usePlaylistManagement'
import AppSectionHeader from '@/components/ui/AppSectionHeader'
import SurfaceCard from '@/components/ui/SurfaceCard'
import MergingBulkEditingSection from '@/components/playlists/management/MergingBulkEditingSection'
import ShufflePlaylistSection from '@/components/playlists/management/ShufflePlaylistSection'
import UtilityStubSection from '@/components/playlists/management/UtilityStubSection'

type PlaylistManagementSectionProps = {
  management: PlaylistManagementState
}

export default function PlaylistManagementSection({ management }: PlaylistManagementSectionProps) {
  if (!management.permissions.canManage) {
    return (
      <div className="space-y-6">
        <SurfaceCard>
          <AppSectionHeader
            eyebrow="Manage"
            description="Only the playlist owner can copy songs between playlists."
            className="gap-0"
          />
        </SurfaceCard>
        {management.utilitySections.map((section) => (
          <UtilityStubSection
            key={section.id}
            title={section.title}
            description={section.description}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <MergingBulkEditingSection management={management} />
      <ShufflePlaylistSection shuffle={management.shuffle} />
      {management.utilitySections.map((section) => (
        <UtilityStubSection
          key={section.id}
          title={section.title}
          description={section.description}
        />
      ))}
    </div>
  )
}
