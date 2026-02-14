'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { queryKeys } from '@/lib/constants/queryKeys'
import { apiJsonOrNull } from '../lib/api'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'

type ThemeSetting = 'light' | 'dark' | 'system'

type UserSettings = {
  theme: ThemeSetting
  receive_emails: boolean
}

const THEME_STORAGE_KEY = 'votuna-theme'
const PROVIDER_STORAGE_KEY = 'votuna-provider'

function resolveTheme(theme: ThemeSetting) {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function applyTheme(theme: ThemeSetting) {
  const resolved = resolveTheme(theme)
  document.documentElement.dataset.theme = resolved
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

function applyProviderTheme(provider: string | null | undefined) {
  if (!provider) {
    delete document.documentElement.dataset.provider
    localStorage.removeItem(PROVIDER_STORAGE_KEY)
    return
  }
  document.documentElement.dataset.provider = provider.toLowerCase()
  localStorage.setItem(PROVIDER_STORAGE_KEY, provider.toLowerCase())
}

/** Apply the stored user theme preference and provider-based theme to the document. */
export default function ThemeManager() {
  const [theme, setTheme] = useState<ThemeSetting>('system')
  const [provider, setProvider] = useState<string | null>(null)
  const currentUserQuery = useCurrentUser()

  useEffect(() => {
    const storedTheme = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeSetting | null) ?? 'system'
    setTheme(storedTheme)
    applyTheme(storedTheme)

    // Apply stored provider theme if available
    const storedProvider = localStorage.getItem(PROVIDER_STORAGE_KEY)
    if (storedProvider) {
      setProvider(storedProvider)
      applyProviderTheme(storedProvider)
    }
  }, [])

  const settingsQuery = useQuery({
    queryKey: queryKeys.userSettings,
    queryFn: () => apiJsonOrNull<UserSettings>('/api/v1/users/me/settings'),
    refetchInterval: 60_000,
    staleTime: 60_000,
  })

  // Apply user's auth provider theme
  useEffect(() => {
    if (!currentUserQuery.data?.auth_provider) return
    setProvider(currentUserQuery.data.auth_provider)
    applyProviderTheme(currentUserQuery.data.auth_provider)
  }, [currentUserQuery.data?.auth_provider])

  useEffect(() => {
    if (!settingsQuery.data?.theme) return
    setTheme(settingsQuery.data.theme)
    applyTheme(settingsQuery.data.theme)
    localStorage.setItem(THEME_STORAGE_KEY, settingsQuery.data.theme)
  }, [settingsQuery.data?.theme])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<UserSettings>).detail
      if (!detail?.theme) return
      setTheme(detail.theme)
      applyTheme(detail.theme)
    }
    window.addEventListener('votuna:settings-updated', handler as EventListener)
    return () => window.removeEventListener('votuna:settings-updated', handler as EventListener)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [theme])

  return null
}
