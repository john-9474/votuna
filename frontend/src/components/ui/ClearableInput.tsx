import type { InputHTMLAttributes } from 'react'

type ClearableInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
  clearAriaLabel?: string
  containerClassName?: string
}

export default function ClearableInput({
  value,
  onValueChange,
  clearAriaLabel = 'Clear input',
  className = '',
  containerClassName = 'w-full',
  disabled,
  readOnly,
  ...props
}: ClearableInputProps) {
  const showClear = Boolean(value) && !disabled && !readOnly

  return (
    <div className={`relative ${containerClassName}`.trim()}>
      <input
        {...props}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => onValueChange(event.target.value)}
        className={`w-full ${className} ${showClear ? 'pr-10' : ''}`.trim()}
      />
      {showClear ? (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label={clearAriaLabel}
          className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-sm font-semibold text-[color:rgb(var(--votuna-ink)/0.55)] transition hover:bg-[rgba(var(--votuna-accent-soft),0.7)] hover:text-[rgb(var(--votuna-ink))]"
        >
          x
        </button>
      ) : null}
    </div>
  )
}
