import { Card } from '@tremor/react'
import type { ComponentProps } from 'react'

type SurfaceCardProps = ComponentProps<typeof Card>

const BASE_CARD_CLASS = 'p-6'

export default function SurfaceCard({ className = '', ...props }: SurfaceCardProps) {
  const classes = `${BASE_CARD_CLASS} ${className}`.trim()
  return <Card className={classes} {...props} />
}
