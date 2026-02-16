import { Text } from '@tremor/react'
import type { ComponentPropsWithoutRef } from 'react'

type SectionEyebrowProps = Omit<ComponentPropsWithoutRef<'p'>, 'color'> & {
  compact?: boolean
  tone?: 'default' | 'strong'
}

const BASE_CLASS = 'text-xs uppercase'
const TRACKING_CLASS = {
  default: 'tracking-[0.25em]',
  compact: 'tracking-[0.2em]',
} as const
const TONE_CLASS = {
  default: 'text-[color:rgb(var(--votuna-ink)/0.4)]',
  strong: 'text-[color:rgb(var(--votuna-ink)/0.45)]',
} as const

export default function SectionEyebrow({
  compact = false,
  tone = 'default',
  className = '',
  ...props
}: SectionEyebrowProps) {
  const tracking = compact ? TRACKING_CLASS.compact : TRACKING_CLASS.default
  const classes = `${BASE_CLASS} ${tracking} ${TONE_CLASS[tone]} ${className}`.trim()
  return <Text className={classes} {...props} />
}
