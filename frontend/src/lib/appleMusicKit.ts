import { apiFetch, apiJson } from '@/lib/api'

const MUSIC_KIT_SCRIPT_ID = 'apple-music-kit-sdk'
const MUSIC_KIT_SCRIPT_SRC = 'https://js-cdn.music.apple.com/musickit/v1/musickit.js'
export const APPLE_MUSICKIT_AUTO_CONNECT_KEY = 'votuna:apple-musickit:auto-connect'
const MUSIC_KIT_SCRIPT_LOAD_TIMEOUT_MS = 15000
const MUSIC_KIT_AUTHORIZE_TIMEOUT_MS = 20000

type AppleMusicKitConfig = {
  developer_token: string
  storefront: string
}

type MusicKitConfigureOptions = {
  developerToken: string
  storefrontId?: string
  app?: {
    name: string
    build: string
  }
}

type MusicKitInstance = {
  authorize: () => Promise<string>
  musicUserToken?: string | null
}

type MusicKitNamespace = {
  configure: (options: MusicKitConfigureOptions) => void
  getInstance: () => MusicKitInstance
}

declare global {
  interface Window {
    MusicKit?: MusicKitNamespace
  }
}

let musicKitReadyPromise: Promise<MusicKitNamespace> | null = null
let configuredTokenSignature = ''

function _readMusicKitFromWindow(): MusicKitNamespace | null {
  if (typeof window === 'undefined') return null
  return window.MusicKit ?? null
}

async function _withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

async function _ensureMusicKitReady(): Promise<MusicKitNamespace> {
  const existingMusicKit = _readMusicKitFromWindow()
  if (existingMusicKit) return existingMusicKit

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Apple Music authorization is only available in a browser')
  }

  if (!musicKitReadyPromise) {
    musicKitReadyPromise = new Promise<MusicKitNamespace>((resolve, reject) => {
      let settled = false
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null

      const resolveOnce = (musicKit: MusicKitNamespace) => {
        if (settled) return
        settled = true
        if (timeoutHandle) clearTimeout(timeoutHandle)
        resolve(musicKit)
      }

      const rejectOnce = (error: Error) => {
        if (settled) return
        settled = true
        if (timeoutHandle) clearTimeout(timeoutHandle)
        reject(error)
      }

      const onReady = () => {
        const musicKit = _readMusicKitFromWindow()
        if (!musicKit) {
          rejectOnce(new Error('Apple MusicKit script loaded but MusicKit is unavailable'))
          return
        }
        resolveOnce(musicKit)
      }

      timeoutHandle = setTimeout(() => {
        rejectOnce(new Error('Timed out loading Apple MusicKit script'))
      }, MUSIC_KIT_SCRIPT_LOAD_TIMEOUT_MS)

      const script = document.getElementById(MUSIC_KIT_SCRIPT_ID) as HTMLScriptElement | null
      if (script) {
        if (script.dataset.loaded === '1') {
          onReady()
          return
        }
        const readyState = script.readyState
        if (readyState === 'complete' || readyState === 'loaded') {
          script.dataset.loaded = '1'
          onReady()
          return
        }
        script.addEventListener('load', onReady, { once: true })
        script.addEventListener(
          'error',
          () => rejectOnce(new Error('Failed to load Apple MusicKit script')),
          { once: true },
        )
        return
      }

      const nextScript = document.createElement('script')
      nextScript.id = MUSIC_KIT_SCRIPT_ID
      nextScript.src = MUSIC_KIT_SCRIPT_SRC
      nextScript.async = true
      nextScript.onload = () => {
        nextScript.dataset.loaded = '1'
        onReady()
      }
      nextScript.onerror = () => rejectOnce(new Error('Failed to load Apple MusicKit script'))
      document.head.appendChild(nextScript)
    })
  }

  return musicKitReadyPromise
}

async function _authorizeMusicKitUser(config: AppleMusicKitConfig): Promise<string> {
  const developerToken = (config.developer_token || '').trim()
  if (!developerToken) {
    throw new Error('Missing Apple Music developer token')
  }
  const storefront = (config.storefront || 'us').trim() || 'us'

  const musicKit = await _ensureMusicKitReady()
  const tokenSignature = `${developerToken}:${storefront}`
  if (configuredTokenSignature !== tokenSignature) {
    musicKit.configure({
      developerToken,
      storefrontId: storefront,
      app: {
        name: 'Votuna',
        build: '1.0.0',
      },
    })
    configuredTokenSignature = tokenSignature
  }

  const instance = musicKit.getInstance()
  const existingToken = typeof instance.musicUserToken === 'string' ? instance.musicUserToken.trim() : ''
  if (existingToken) {
    return existingToken
  }

  const authorizedToken = await _withTimeout(
    instance.authorize(),
    MUSIC_KIT_AUTHORIZE_TIMEOUT_MS,
    'Apple Music authorization timed out. Click Connect Apple Music to continue.',
  )
  const normalizedToken = typeof authorizedToken === 'string' ? authorizedToken.trim() : ''
  if (!normalizedToken) {
    throw new Error('Apple Music authorization did not return a user token')
  }
  return normalizedToken
}

export async function connectAppleMusicUserToken(): Promise<void> {
  const config = await apiJson<AppleMusicKitConfig>('/api/v1/auth/apple/music-kit/config', {
    authRequired: true,
  })
  const musicUserToken = await _authorizeMusicKitUser(config)
  const response = await apiFetch('/api/v1/auth/apple/music-user-token', {
    method: 'POST',
    authRequired: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ music_user_token: musicUserToken }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = typeof body.detail === 'string' ? body.detail : 'Failed to sync Apple Music authorization'
    throw new Error(detail)
  }
}
