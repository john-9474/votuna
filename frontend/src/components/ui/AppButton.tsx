import { Button } from '@tremor/react'
import type { ComponentProps } from 'react'

type TremorButtonProps = ComponentProps<typeof Button>

export type AppButtonIntent = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'icon'

type AppButtonProps = TremorButtonProps & {
  intent?: AppButtonIntent
}

const BASE_CLASS = 'rounded-full'

const INTENT_STYLES: Record<
  AppButtonIntent,
  Pick<TremorButtonProps, 'variant' | 'color'> & { className?: string }
> = {
  primary: { variant: 'primary', className: '' },
  secondary: { variant: 'secondary', className: '' },
  danger: { variant: 'secondary', color: 'rose' },
  ghost: { variant: 'light' },
  success: { variant: 'secondary', color: 'emerald' },
  icon: { variant: 'secondary', className: 'h-10 w-10 p-0' },
}

export default function AppButton({
  intent = 'primary',
  variant,
  color,
  className = '',
  ...props
}: AppButtonProps) {
  const intentConfig = INTENT_STYLES[intent]
  const resolvedVariant = variant ?? intentConfig.variant
  const resolvedColor = color ?? intentConfig.color
  const classes = `${BASE_CLASS} ${intentConfig.className ?? ''} ${className}`.trim()

  return (
    <Button
      {...props}
      variant={resolvedVariant}
      color={resolvedColor}
      className={classes}
    />
  )
}
