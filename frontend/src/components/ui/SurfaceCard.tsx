import { Card } from '@tremor/react'
import type { ComponentProps } from 'react'

type SurfaceCardProps = ComponentProps<typeof Card>

const BASE_CARD_CLASS =
  'p-6 bg-[rgba(var(--votuna-sand),0.88)] dark:bg-[rgb(var(--votuna-paper))] ring-[color:rgb(var(--votuna-ink)/0.08)] dark:ring-[color:rgb(var(--votuna-ink)/0.12)]'

export default function SurfaceCard({ className = '', ...props }: SurfaceCardProps) {
  const classes = `${BASE_CARD_CLASS} ${className}`.trim()
  return <Card className={classes} {...props} />
}
