import { TextInput } from '@tremor/react'
import type { ComponentProps } from 'react'

type ClearableTextInputProps = Omit<ComponentProps<typeof TextInput>, 'value' | 'onValueChange'> & {
  value: string
  onValueChange: (value: string) => void
  clearAriaLabel?: string
  containerClassName?: string
}

export default function ClearableTextInput({
  value,
  onValueChange,
  clearAriaLabel = 'Clear input',
  className = '',
  containerClassName = 'w-full',
  disabled,
  ...props
}: ClearableTextInputProps) {
  const showClear = Boolean(value) && !disabled

  return (
    <div className={`relative ${containerClassName}`.trim()}>
      <TextInput
        {...props}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        className={`${className} ${showClear ? 'pr-10' : ''}`.trim()}
      />
      {showClear ? (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label={clearAriaLabel}
          className="absolute right-2 top-1/2 z-10 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-sm font-semibold text-[color:rgb(var(--votuna-ink)/0.55)] transition hover:bg-[rgba(var(--votuna-accent-soft),0.7)] hover:text-[rgb(var(--votuna-ink))]"
        >
          x
        </button>
      ) : null}
    </div>
  )
}
