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
  image_url?: string | null
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
  genre?: string | null
  artwork_url?: string | null
  url?: string | null
  added_at?: string | null
  suggested_by_user_id?: number | null
  suggested_by_display_name?: string | null
}

export type ManagementProviderPlaylistRef = {
  kind: 'provider'
  provider: string
  provider_playlist_id: string
}

export type ManagementVotunaPlaylistRef = {
  kind: 'votuna'
  votuna_playlist_id: number
}

export type ManagementPlaylistRef = ManagementProviderPlaylistRef | ManagementVotunaPlaylistRef

export type ManagementDirection = 'import_to_current' | 'export_from_current'

export type ManagementSelectionMode = 'all' | 'genre' | 'artist' | 'songs'

export type ManagementDestinationCreate = {
  title: string
  description?: string | null
  is_public?: boolean | null
}

export type ManagementSourceTracksRequest = {
  source: ManagementPlaylistRef
  search?: string | null
  limit: number
  offset: number
}

export type ManagementSourceTracksResponse = {
  tracks: ProviderTrack[]
  total_count: number
  limit: number
  offset: number
}

export type ManagementFacetCount = {
  value: string
  count: number
}

export type ManagementFacetsRequest = {
  source: ManagementPlaylistRef
}

export type ManagementFacetsResponse = {
  genres: ManagementFacetCount[]
  artists: ManagementFacetCount[]
  total_tracks_considered: number
}

export type ManagementTransferRequest = {
  direction: ManagementDirection
  counterparty?: ManagementPlaylistRef | null
  destination_create?: ManagementDestinationCreate | null
  selection_mode: ManagementSelectionMode
  selection_values: string[]
}

export type ManagementPlaylistSummary = {
  provider: string
  provider_playlist_id: string
  title: string
}

export type ManagementPreviewResponse = {
  source: ManagementPlaylistSummary
  destination: ManagementPlaylistSummary
  selection_mode: ManagementSelectionMode
  selection_values: string[]
  matched_count: number
  to_add_count: number
  duplicate_count: number
  max_tracks_per_action: number
  matched_sample: ProviderTrack[]
  duplicate_sample: ProviderTrack[]
}

export type ManagementFailedItem = {
  provider_track_id: string
  error: string
}

export type ManagementExecuteResponse = {
  source: ManagementPlaylistSummary
  destination: ManagementPlaylistSummary
  created_destination?: ManagementPlaylistSummary | null
  matched_count: number
  added_count: number
  skipped_duplicate_count: number
  failed_count: number
  failed_items: ManagementFailedItem[]
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
