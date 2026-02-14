/**
 * Provider-specific color themes for UI customization
 */

export type ProviderColorScheme = {
  name: string
  primary: string // RGB values for use with --votuna-primary
  primaryHex: string
  accent: string // Light variant
  accentHex: string
  description: string
}

export const PROVIDER_COLORS: Record<string, ProviderColorScheme> = {
  spotify: {
    name: 'Spotify',
    primary: '29 185 84', // Spotify Green
    primaryHex: '#1DB954',
    accent: '29 185 84',
    accentHex: '#1DB954',
    description: 'Spotify green theme',
  },
  soundcloud: {
    name: 'SoundCloud',
    primary: '255 136 0', // SoundCloud Orange
    primaryHex: '#FF8800',
    accent: '255 200 100',
    accentHex: '#FFC864',
    description: 'SoundCloud orange theme',
  },
}

export function getProviderColor(provider: string | null | undefined): ProviderColorScheme | null {
  if (!provider) return null
  const normalized = provider.toLowerCase()
  return PROVIDER_COLORS[normalized] ?? null
}

export function getProviderColors(provider: string | null | undefined) {
  return getProviderColor(provider) ?? PROVIDER_COLORS.spotify // Default to spotify
}
