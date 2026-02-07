import SurfaceCard from '@/components/ui/SurfaceCard'

type UtilityStubSectionProps = {
  title: string
  description: string
}

export default function UtilityStubSection({ title, description }: UtilityStubSectionProps) {
  return (
    <SurfaceCard className="opacity-85">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
        Coming soon
      </p>
      <h3 className="mt-2 text-lg font-semibold text-[rgb(var(--votuna-ink))]">{title}</h3>
      <p className="mt-1 text-sm text-[color:rgb(var(--votuna-ink)/0.64)]">{description}</p>
    </SurfaceCard>
  )
}

