import { Badge } from '@tremor/react'

import ClearableTextInput from '@/components/ui/ClearableTextInput'
import AppButton from '@/components/ui/AppButton'
import StatusCallout from '@/components/ui/StatusCallout'
import { hasValue } from '@/lib/hooks/playlistDetail/management/shared'

type FacetSelectorProps = {
  label: string
  customPlaceholder: string
  selectedValues: string[]
  suggestions: Array<{ value: string; count: number }>
  customInput: string
  onCustomInputChange: (value: string) => void
  onAddCustomValue: () => void
  onToggleSuggestion: (value: string) => void
  onRemoveValue: (value: string) => void
  isLoading: boolean
  status: string
}

export default function FacetSelector({
  label,
  customPlaceholder,
  selectedValues,
  suggestions,
  customInput,
  onCustomInputChange,
  onAddCustomValue,
  onToggleSuggestion,
  onRemoveValue,
  isLoading,
  status,
}: FacetSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">{label}</p>

      <div className="flex gap-2">
        <ClearableTextInput
          value={customInput}
          onValueChange={onCustomInputChange}
          containerClassName="flex-1"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onAddCustomValue()
            }
          }}
          placeholder={customPlaceholder}
          clearAriaLabel={`Clear ${label.toLowerCase()} input`}
        />
        <AppButton intent="secondary" onClick={onAddCustomValue}>
          Add
        </AppButton>
      </div>

      {selectedValues.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {selectedValues.map((value) => (
            <div key={`selected-${value.toLowerCase()}`} className="flex items-center gap-1">
              <Badge color="gray">{value}</Badge>
              <AppButton
                intent="icon"
                size="xs"
                aria-label={`Remove ${value}`}
                onClick={() => onRemoveValue(value)}
              >
                x
              </AppButton>
            </div>
          ))}
        </div>
      ) : (
        <StatusCallout tone="info" title={`No ${label.toLowerCase()}`}>
          No {label.toLowerCase()} selected yet.
        </StatusCallout>
      )}

      {status ? (
        <StatusCallout tone="error" title={`${label} status`}>
          {status}
        </StatusCallout>
      ) : null}
      {isLoading ? (
        <StatusCallout tone="info" title="Loading suggestions">
          Loading suggestions...
        </StatusCallout>
      ) : suggestions.length > 0 ? (
        <div>
          <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.58)]">Suggested from source playlist</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((item) => {
              const selected = hasValue(selectedValues, item.value)
              return (
                <AppButton
                  key={`${item.value.toLowerCase()}-${item.count}`}
                  intent={selected ? 'primary' : 'secondary'}
                  size="xs"
                  onClick={() => onToggleSuggestion(item.value)}
                >
                  {item.value} ({item.count})
                </AppButton>
              )
            })}
          </div>
        </div>
      ) : (
        <StatusCallout tone="info" title="No suggestions">
          No suggestions available for this source playlist. You can still add custom values.
        </StatusCallout>
      )}
    </div>
  )
}
