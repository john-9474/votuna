'use client'

import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import AppButton from '@/components/ui/AppButton'
import LoginProviderDialog from '@/components/navbar/LoginProviderDialog'
import UserMenu from '@/components/navbar/UserMenu'
import { currentUserQueryKey, useCurrentUser } from '@/lib/hooks/useCurrentUser'
import type { User } from '@/lib/types/user'
import { apiFetch, API_URL } from '../lib/api'

/** Select the best display name for the current user. */
function getDisplayName(user: User | null) {
  if (!user) return ''
  if (user.display_name) return user.display_name
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  if (fullName) return fullName
  return user.email ?? 'Account'
}

/** Site navigation with auth controls and login modal. */
export default function Navbar() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [loginOpen, setLoginOpen] = useState(false)
  const userQuery = useCurrentUser()
  const user = userQuery.data ?? null
  const loading = userQuery.isLoading || userQuery.isFetching

  const displayName = useMemo(() => getDisplayName(user), [user])
  const avatarSrc = useMemo(() => {
    if (!user?.avatar_url) return ''
    const version = encodeURIComponent(user.avatar_url)
    return `${API_URL}/api/v1/users/me/avatar?v=${version}`
  }, [user])

  useEffect(() => {
    if (user) {
      setLoginOpen(false)
    }
  }, [user])

  /** Start the SoundCloud OAuth flow. */
  const handleSoundcloudLogin = () => {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.href = `${API_URL}/api/v1/auth/login/soundcloud?next=${encodeURIComponent(next)}`
  }

  /** Start the Spotify OAuth flow. */
  const handleSpotifyLogin = () => {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.href = `${API_URL}/api/v1/auth/login/spotify?next=${encodeURIComponent(next)}`
  }

  /** Clear the auth cookie and local session state. */
  const handleLogout = async () => {
    try {
      await apiFetch('/api/v1/auth/logout', {
        method: 'POST',
        authRequired: false,
      })
    } finally {
      queryClient.setQueryData(currentUserQueryKey, null)
      queryClient.removeQueries({ queryKey: currentUserQueryKey, exact: true })
      window.dispatchEvent(new CustomEvent('votuna:user-updated', { detail: null }))
      setLoginOpen(false)
      router.replace('/')
      router.refresh()
    }
  }

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<User | null>).detail
      queryClient.setQueryData(currentUserQueryKey, detail ?? null)
    }
    window.addEventListener('votuna:user-updated', handler as EventListener)
    return () => window.removeEventListener('votuna:user-updated', handler as EventListener)
  }, [queryClient])

  useEffect(() => {
    const handler = () => {
      setLoginOpen(true)
      queryClient.clear()
      router.replace('/')
    }
    window.addEventListener('votuna:auth-expired', handler as EventListener)
    return () => window.removeEventListener('votuna:auth-expired', handler as EventListener)
  }, [queryClient, router])

  return (
    <nav className="sticky top-0 z-40 border-b border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-2">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
          <Image
            src="/img/logo.png"
            alt="Votuna logo"
            width={80}
            height={80}
            priority
            className="h-20 w-20 object-contain"
          />
          <span className="text-[rgb(var(--votuna-ink))]">Votuna</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <UserMenu
              displayName={displayName}
              avatarSrc={avatarSrc}
              onLogout={handleLogout}
            />
          ) : (
            <AppButton
              onClick={() => setLoginOpen(true)}
              className="px-5 py-2 text-sm"
            >
              {loading ? 'Checking session...' : 'Log in'}
            </AppButton>
          )}
        </div>
      </div>

      <LoginProviderDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSpotifyLogin={handleSpotifyLogin}
        onSoundcloudLogin={handleSoundcloudLogin}
      />
    </nav>
  )
}
