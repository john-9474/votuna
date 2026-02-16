import type { ComponentPropsWithoutRef } from 'react'
import { getLinkButtonClassName, type SharedLinkButtonIntent } from '@/components/ui/linkButtonStyles'

export type AppLinkButtonIntent = SharedLinkButtonIntent

type AppLinkButtonProps = ComponentPropsWithoutRef<'a'> & {
  intent?: AppLinkButtonIntent
}

export default function AppLinkButton({
  intent = 'outline',
  className = '',
  ...props
}: AppLinkButtonProps) {
  const classes = getLinkButtonClassName(intent, className)
  return <a className={classes} {...props} />
}
