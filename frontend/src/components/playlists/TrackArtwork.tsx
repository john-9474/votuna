import Image from 'next/image'

type TrackArtworkProps = {
  artworkUrl?: string | null
  title: string
  isLoading?: boolean
}

export default function TrackArtwork({ artworkUrl, title, isLoading = false }: TrackArtworkProps) {
  if (artworkUrl) {
    return (
      <Image
        src={artworkUrl}
        alt={`${title} artwork`}
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
      />
    )
  }
  if (isLoading) {
    return (
      <div
        aria-hidden="true"
        className="h-10 w-10 flex-shrink-0 animate-pulse rounded-lg border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-ink),0.08)]"
      />
    )
  }
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-ink),0.05)] text-[9px] uppercase tracking-[0.14em] text-[color:rgb(var(--votuna-ink)/0.45)]">
      No Art
    </div>
  )
}
