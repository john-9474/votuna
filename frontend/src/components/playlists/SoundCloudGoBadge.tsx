import { RiVipCrown2Line } from '@remixicon/react'

type SoundCloudGoBadgeProps = {
  provider: string | null | undefined
  access: string | null | undefined
  className?: string
}

export default function SoundCloudGoBadge({
  provider,
  access,
  className = '',
}: SoundCloudGoBadgeProps) {
  const normalizedProvider = provider?.trim().toLowerCase() ?? ''
  const normalizedAccess = access?.trim().toLowerCase() ?? ''
  if (normalizedProvider !== 'soundcloud' || normalizedAccess !== 'preview') {
    return null
  }

  return (
    <span
      title="SoundCloud Go+ preview-only song"
      className={`inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 ${className}`.trim()}
    >
      <RiVipCrown2Line className="h-3 w-3" />
      <span>Go+</span>
    </span>
  )
}
