export type PlaylistSettings = {
  id: number
  playlist_id: number
  required_vote_percent: number
  tie_break_mode: 'add' | 'reject'
}

export type PlaylistSettingsForm = {
  required_vote_percent: number
  tie_break_mode: 'add' | 'reject'
}

export type PlaylistType = 'personal' | 'collaborative'

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
  playlist_id: number
  provider_track_id: string
  track_title?: string | null
  track_artist?: string | null
  track_artwork_url?: string | null
  track_url?: string | null
  suggested_by_user_id?: number | null
  created_at?: string | null
  updated_at?: string | null
  resolved_at?: string | null
  resolution_reason?:
    | 'threshold_met'
    | 'threshold_not_met'
    | 'tie_add'
    | 'tie_reject'
    | 'force_add'
    | 'canceled_by_suggester'
    | 'canceled_by_owner'
    | null
  status: string
  upvote_count: number
  downvote_count: number
  my_reaction?: 'up' | 'down' | null
  upvoter_display_names?: string[]
  downvoter_display_names?: string[]
  collaborators_left_to_vote_count?: number
  collaborators_left_to_vote_names?: string[]
  can_cancel?: boolean
  can_force_add?: boolean
}

export type ProviderTrack = {
  provider_track_id: string
  title: string
  artist?: string | null
  genre?: string | null
  artwork_url?: string | null
  url?: string | null
  added_at?: string | null
  added_source?: 'votuna_suggestion' | 'playlist_utils' | 'outside_votuna' | 'personal_add'
  added_by_label?: string | null
  suggested_by_user_id?: number | null
  suggested_by_display_name?: string | null
}

export type RecommendationDeclineRequest = {
  provider_track_id: string
}

export type PersonalizePlaylistResponse = {
  playlist_type: 'personal'
  removed_collaborators: number
  revoked_invites: number
  canceled_suggestions: number
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
  profile_url?: string | null
  role: string
  joined_at: string
  suggested_count: number
}

export type InviteCandidate = {
  source: 'registered' | 'provider'
  provider_user_id: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
  profile_url?: string | null
  is_registered: boolean
  registered_user_id?: number | null
}

export type CreateInviteRequest =
  | {
      kind: 'user'
      target_provider_user_id: string
    }
  | {
      kind: 'link'
      expires_in_hours?: number
      max_uses?: number
    }

export type PlaylistInvite = {
  id: number
  playlist_id: number
  invite_type: 'link' | 'user'
  token: string
  expires_at?: string | null
  max_uses?: number | null
  uses_count: number
  is_revoked: boolean
  target_auth_provider?: string | null
  target_provider_user_id?: string | null
  target_username_snapshot?: string | null
  target_display_name?: string | null
  target_username?: string | null
  target_avatar_url?: string | null
  target_profile_url?: string | null
  target_user_id?: number | null
  accepted_by_user_id?: number | null
  accepted_at?: string | null
  invite_url?: string | null
  created_at: string
  updated_at: string
}

export type PendingInvite = {
  invite_id: number
  playlist_id: number
  playlist_title: string
  playlist_image_url?: string | null
  playlist_provider: string
  owner_user_id: number
  owner_display_name?: string | null
  created_at: string
  expires_at?: string | null
}
