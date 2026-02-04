'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { apiJsonOrNull } from '../lib/api'

type ThemeSetting = 'light' | 'dark' | 'system'

type UserSettings = {
  theme: ThemeSetting
  receive_emails: boolean
}

const THEME_STORAGE_KEY = 'votuna-theme'

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

/** Apply the stored user theme preference to the document. */
export default function ThemeManager() {
  const [theme, setTheme] = useState<ThemeSetting>('system')

  useEffect(() => {
    const storedTheme = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeSetting | null) ?? 'system'
    setTheme(storedTheme)
    applyTheme(storedTheme)
  }, [])

  const settingsQuery = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => apiJsonOrNull<UserSettings>('/api/v1/users/me/settings'),
    refetchInterval: 60_000,
    staleTime: 60_000,
  })

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
