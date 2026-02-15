import { Callout } from '@tremor/react'
import type { ComponentProps } from 'react'

type TremorCalloutProps = Omit<ComponentProps<typeof Callout>, 'title' | 'color' | 'children'>

export type StatusCalloutTone = 'info' | 'success' | 'warning' | 'error'

type StatusCalloutProps = TremorCalloutProps & {
  tone?: StatusCalloutTone
  title?: string
  children: string | number | Array<string | number>
}

const TONE_CONFIG: Record<StatusCalloutTone, { color: ComponentProps<typeof Callout>['color']; title: string }> = {
  info: { color: 'blue', title: 'Info' },
  success: { color: 'emerald', title: 'Success' },
  warning: { color: 'amber', title: 'Warning' },
  error: { color: 'rose', title: 'Error' },
}

export default function StatusCallout({
  tone = 'info',
  title,
  className = '',
  children,
  ...props
}: StatusCalloutProps) {
  const config = TONE_CONFIG[tone]
  const resolvedTitle = title ?? config.title
  const classes = `text-sm ${className}`.trim()

  return (
    <Callout {...props} color={config.color} title={resolvedTitle} className={classes}>
      {children}
    </Callout>
  )
}
