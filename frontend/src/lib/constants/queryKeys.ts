export const queryKeys = {
  currentUser: ['currentUser'] as const,
  userSettings: ['userSettings'] as const,
  providerPlaylistsRoot: ['providerPlaylists'] as const,
  providerPlaylistsByProvider: (provider: string) =>
    ['providerPlaylists', provider] as const,
  votunaPlaylists: ['votunaPlaylists'] as const,
  votunaPlaylist: (playlistId: string | undefined) =>
    ['votunaPlaylist', playlistId] as const,
  votunaSuggestions: (playlistId: string | undefined) =>
    ['votunaSuggestions', playlistId] as const,
  votunaTracks: (playlistId: string | undefined) =>
    ['votunaTracks', playlistId] as const,
  votunaMembers: (playlistId: string | undefined) =>
    ['votunaMembers', playlistId] as const,
  votunaManagementSourceTracks: (
    playlistId: string | undefined,
    sourceKey: string,
    search: string,
    limit: number,
    offset: number,
  ) =>
    ['votunaManagementSourceTracks', playlistId, sourceKey, search, limit, offset] as const,
  votunaManagementFacets: (
    playlistId: string | undefined,
    sourceKey: string,
  ) => ['votunaManagementFacets', playlistId, sourceKey] as const,
}
