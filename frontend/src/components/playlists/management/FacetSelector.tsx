import { hasValue } from '@/lib/hooks/playlistDetail/management/shared'
import ClearableInput from '@/components/ui/ClearableInput'

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
      <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
        {label}
      </p>

      <div className="flex gap-2">
        <ClearableInput
          value={customInput}
          onValueChange={onCustomInputChange}
          containerClassName="flex-1"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onAddCustomValue()
            }
          }}
          className="w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.92)] px-4 py-2 text-sm"
          placeholder={customPlaceholder}
          clearAriaLabel={`Clear ${label.toLowerCase()} input`}
        />
        <button
          type="button"
          onClick={onAddCustomValue}
          className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.16)] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-ink))]"
        >
          Add
        </button>
      </div>

      {selectedValues.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map((value) => (
            <button
              key={`selected-${value.toLowerCase()}`}
              type="button"
              onClick={() => onRemoveValue(value)}
              className="rounded-full bg-[rgb(var(--votuna-ink))] px-3 py-1.5 text-xs font-semibold text-[rgb(var(--votuna-paper))]"
            >
              {value} x
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.58)]">
          No {label.toLowerCase()} selected yet.
        </p>
      )}

      {status ? <p className="text-xs text-rose-500">{status}</p> : null}
      {isLoading ? (
        <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.58)]">Loading suggestions...</p>
      ) : suggestions.length > 0 ? (
        <div>
          <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.58)]">
            Suggested from source playlist
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((item) => {
              const selected = hasValue(selectedValues, item.value)
              return (
                <button
                  key={`${item.value.toLowerCase()}-${item.count}`}
                  type="button"
                  onClick={() => onToggleSuggestion(item.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    selected
                      ? 'border-transparent bg-[rgba(var(--votuna-accent-soft),0.8)] font-semibold text-[rgb(var(--votuna-ink))]'
                      : 'border-[color:rgb(var(--votuna-ink)/0.16)] text-[color:rgb(var(--votuna-ink)/0.75)]'
                  }`}
                >
                  {item.value} ({item.count})
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.58)]">
          No suggestions available for this source playlist. You can still add custom values.
        </p>
      )}
    </div>
  )
}
