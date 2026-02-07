export type PlaylistSettings = {
  id: number
  playlist_id: number
  required_vote_percent: number
  auto_add_on_threshold: boolean
}

export type PlaylistSettingsForm = {
  required_vote_percent: number
  auto_add_on_threshold: boolean
}

export type VotunaPlaylist = {
  id: number
  owner_user_id: number
  title: string
  description?: string | null
  provider: string
  provider_playlist_id: string
  is_active: boolean
  settings?: PlaylistSettings | null
}

export type Suggestion = {
  id: number
  provider_track_id: string
  track_title?: string | null
  track_artist?: string | null
  track_artwork_url?: string | null
  track_url?: string | null
  suggested_by_user_id?: number | null
  voter_display_names?: string[]
  created_at?: string | null
  status: string
  vote_count: number
}

export type ProviderTrack = {
  provider_track_id: string
  title: string
  artist?: string | null
  artwork_url?: string | null
  url?: string | null
  added_at?: string | null
  suggested_by_user_id?: number | null
  suggested_by_display_name?: string | null
}

export type PlayerTrack = {
  key: string
  title: string
  artist?: string | null
  url: string
  artwork_url?: string | null
}

export type TrackPlayRequest = {
  key: string
  title: string
  artist?: string | null
  url?: string | null
  artworkUrl?: string | null
}

export type PlaylistMember = {
  user_id: number
  display_name?: string | null
  avatar_url?: string | null
  role: string
  joined_at: string
  suggested_count: number
}
