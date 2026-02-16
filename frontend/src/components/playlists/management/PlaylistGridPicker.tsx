import { Grid, Text } from '@tremor/react'

type PlaylistGridOption = {
  key: string
  label: string
  sourceTypeLabel: string
  imageUrl: string | null
}

type PlaylistGridPickerProps = {
  options: PlaylistGridOption[]
  selectedKey: string
  onSelect: (key: string) => void
  emptyMessage?: string
}

export default function PlaylistGridPicker({
  options,
  selectedKey,
  onSelect,
  emptyMessage,
}: PlaylistGridPickerProps) {
  if (options.length === 0) {
    return (
      <Text className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">
        {emptyMessage || 'No eligible playlists found yet. Create or sync another playlist first.'}
      </Text>
    )
  }

  return (
    <Grid className="gap-3" numItems={1} numItemsSm={2} numItemsLg={3}>
      {options.map((option) => {
        const isSelected = selectedKey === option.key
        const initial = option.label.trim().charAt(0).toUpperCase() || '?'
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onSelect(option.key)}
            className={`overflow-hidden rounded-2xl border text-left transition ${
              isSelected
                ? 'border-[rgb(var(--votuna-ink))] bg-[rgba(var(--votuna-accent-soft),0.45)] shadow-sm'
                : 'border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.85)] hover:border-[color:rgb(var(--votuna-ink)/0.28)]'
            }`}
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-[rgba(var(--votuna-accent-soft),0.45)]">
              {option.imageUrl ? (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${option.imageUrl})` }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[color:rgb(var(--votuna-ink)/0.55)]">
                  {initial}
                </div>
              )}
              <span
                className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold ${
                  isSelected
                    ? 'bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))]'
                    : 'bg-[rgba(var(--votuna-paper),0.88)] text-[rgb(var(--votuna-ink))]'
                }`}
              >
                {isSelected ? 'Selected' : ''}
              </span>
            </div>
            <div className="p-3">
              <Text className="truncate text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                {option.label}
              </Text>
            </div>
          </button>
        )
      })}
    </Grid>
  )
}
