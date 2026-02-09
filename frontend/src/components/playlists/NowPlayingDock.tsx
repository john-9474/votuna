import type { PlayerTrack } from '@/lib/types/votuna'

import TrackArtwork from './TrackArtwork'

type NowPlayingDockProps = {
  track: PlayerTrack
  onClose: () => void
}

const buildSoundcloudEmbedUrl = (
  trackUrl: string | null | undefined,
  autoPlay: boolean = false,
) => {
  if (!trackUrl) return ''
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=${autoPlay ? 'true' : 'false'}&hide_related=true&show_comments=true&show_user=true&show_reposts=false&visual=false`
}

export default function NowPlayingDock({ track, onClose }: NowPlayingDockProps) {
  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-full max-w-6xl -translate-x-1/2 px-6">
      <div className="rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.98)] p-3 shadow-2xl shadow-black/25 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <TrackArtwork artworkUrl={track.artwork_url} title={track.title} />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
                Now Playing
              </p>
              <p className="truncate text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                {track.title}
              </p>
              <p className="truncate text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                {track.artist || 'Unknown artist'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={track.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-24 justify-center rounded-full border border-[color:rgb(var(--votuna-ink)/0.18)] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-ink))] hover:bg-[rgba(var(--votuna-paper),0.7)]"
            >
              Open
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-24 justify-center rounded-full bg-[rgb(var(--votuna-ink))] px-4 py-2 text-xs font-semibold text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
            >
              Close
            </button>
          </div>
        </div>
        <iframe
          title={`Now playing ${track.title}`}
          src={buildSoundcloudEmbedUrl(track.url, true)}
          className="mt-3 h-[10rem] w-full rounded-xl border-0"
          loading="lazy"
          allow="autoplay"
        />
      </div>
    </div>
  )
}
