import AppSectionHeader from '@/components/ui/AppSectionHeader'
import SurfaceCard from '@/components/ui/SurfaceCard'

type UtilityStubSectionProps = {
  title: string
  description: string
}

export default function UtilityStubSection({ title, description }: UtilityStubSectionProps) {
  return (
    <SurfaceCard className="opacity-85">
      <AppSectionHeader
        eyebrow="Coming soon"
        title={title}
        description={description}
        className="gap-0"
        descriptionClassName="mt-1 text-[color:rgb(var(--votuna-ink)/0.64)]"
      />
    </SurfaceCard>
  )
}
