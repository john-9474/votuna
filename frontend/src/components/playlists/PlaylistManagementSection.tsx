import type { PlaylistManagementState } from '@/lib/hooks/playlistDetail/usePlaylistManagement'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'
import MergingBulkEditingSection from '@/components/playlists/management/MergingBulkEditingSection'
import UtilityStubSection from '@/components/playlists/management/UtilityStubSection'

type PlaylistManagementSectionProps = {
  management: PlaylistManagementState
}

export default function PlaylistManagementSection({ management }: PlaylistManagementSectionProps) {
  if (!management.permissions.canManage) {
    return (
      <div className="space-y-6">
        <SurfaceCard>
          <SectionEyebrow>Manage</SectionEyebrow>
          <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.72)]">
            Only the playlist owner can copy songs between playlists.
          </p>
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

