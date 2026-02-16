export type SharedLinkButtonIntent = 'outline' | 'solid' | 'icon'

const BASE_CLASS = 'inline-flex items-center justify-center rounded-full transition'

const INTENT_CLASSES: Record<SharedLinkButtonIntent, string> = {
  outline:
    'px-4 py-2 text-xs font-semibold border border-[color:rgb(var(--votuna-ink)/0.16)] text-[rgb(var(--votuna-ink))] hover:border-[color:rgb(var(--votuna-ink)/0.28)] hover:bg-[rgba(var(--votuna-paper),0.9)]',
  solid:
    'px-4 py-2 text-xs font-semibold bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]',
  icon:
    'p-1.5 border border-[color:rgb(var(--votuna-ink)/0.12)] text-[rgb(var(--votuna-ink))] hover:border-[color:rgb(var(--votuna-ink)/0.24)] hover:bg-[rgba(var(--votuna-accent-soft),0.35)]',
}

export const getLinkButtonClassName = (
  intent: SharedLinkButtonIntent,
  className: string,
) => {
  return `${BASE_CLASS} ${INTENT_CLASSES[intent]} ${className}`.trim()
}
