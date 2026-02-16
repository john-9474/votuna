import Link from 'next/link'
import type { ComponentPropsWithoutRef } from 'react'
import { getLinkButtonClassName, type SharedLinkButtonIntent } from '@/components/ui/linkButtonStyles'

export type AppRouteButtonIntent = Exclude<SharedLinkButtonIntent, 'icon'>

type AppRouteButtonProps = ComponentPropsWithoutRef<typeof Link> & {
  intent?: AppRouteButtonIntent
}

export default function AppRouteButton({
  intent = 'outline',
  className = '',
  ...props
}: AppRouteButtonProps) {
  const classes = getLinkButtonClassName(intent, className)
  return <Link className={classes} {...props} />
}
