import { useState } from 'react'

import type { PlayerTrack, TrackPlayRequest } from '@/lib/types/votuna'

export function usePlaylistPlayer() {
  const [activePlayerTrack, setActivePlayerTrack] = useState<PlayerTrack | null>(null)
  const [playerNonce, setPlayerNonce] = useState(0)

  const playTrack = ({ key, title, artist, url, artworkUrl }: TrackPlayRequest) => {
    if (!url) return
    setActivePlayerTrack({
      key,
      title,
      artist,
      url,
      artwork_url: artworkUrl,
    })
    setPlayerNonce((prev) => prev + 1)
  }

  const closePlayer = () => {
    setActivePlayerTrack(null)
  }

  return {
    playTrack,
    activePlayerTrack,
    playerNonce,
    closePlayer,
  }
}
