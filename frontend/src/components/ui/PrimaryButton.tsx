import type { ComponentProps } from 'react'

import AppButton from '@/components/ui/AppButton'

type PrimaryButtonProps = ComponentProps<typeof AppButton>

export default function PrimaryButton({ className = '', ...props }: PrimaryButtonProps) {
  return <AppButton intent="primary" className={className} {...props} />
}
