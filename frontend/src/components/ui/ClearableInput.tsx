import type { ComponentProps } from 'react'

import ClearableTextInput from '@/components/ui/ClearableTextInput'

type ClearableInputProps = Omit<ComponentProps<typeof ClearableTextInput>, 'value' | 'onValueChange'> & {
  value: string
  onValueChange: (value: string) => void
}

export default function ClearableInput({
  value,
  onValueChange,
  ...props
}: ClearableInputProps) {
  return <ClearableTextInput {...props} value={value} onValueChange={onValueChange} />
}
