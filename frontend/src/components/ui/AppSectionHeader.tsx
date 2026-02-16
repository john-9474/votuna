import { Text, Title } from '@tremor/react'
import type { ReactNode } from 'react'

import SectionEyebrow from '@/components/ui/SectionEyebrow'

type AppSectionHeaderProps = {
  eyebrow?: ReactNode
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  contentClassName?: string
  descriptionClassName?: string
}

export default function AppSectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className = '',
  contentClassName = '',
  descriptionClassName = '',
}: AppSectionHeaderProps) {
  const containerClass = `flex flex-wrap items-start justify-between gap-4 ${className}`.trim()
  const contentClass = contentClassName.trim()
  const descriptionClass = `mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)] ${descriptionClassName}`.trim()

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
        {title ? <Title className="mt-2 text-[rgb(var(--votuna-ink))]">{title}</Title> : null}
        {description ? <Text className={descriptionClass}>{description}</Text> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
