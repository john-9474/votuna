'use client'

import { Menu } from '@headlessui/react'
import { Button, Dialog, DialogPanel } from '@tremor/react'
import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import UserAvatar from '@/components/ui/UserAvatar'
import { currentUserQueryKey, useCurrentUser } from '@/lib/hooks/useCurrentUser'
import type { User } from '@/lib/types/user'
import { apiFetch, API_URL } from '../lib/api'
import { getProviderColor } from '@/lib/providerColors'

/** Select the best display name for the current user. */
function getDisplayName(user: User | null) {
  if (!user) return ''
  if (user.display_name) return user.display_name
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  if (fullName) return fullName
  return user.email ?? 'Account'
}

/** Build a short initials string from the user name. */
function getInitials(user: User | null) {
  const name = getDisplayName(user)
  if (!name) return 'U'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
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
            <>
              {user.auth_provider && (
                <div
                  className="px-2 py-1 rounded-full text-xs font-medium border transition"
                  style={{
                    color: `rgb(${getProviderColor(user.auth_provider)?.primary})`,
                    borderColor: `rgba(${getProviderColor(user.auth_provider)?.primary}, 0.3)`,
                  }}
                >
                  {user.auth_provider === 'spotify' && '🎵 Spotify'}
                  {user.auth_provider === 'soundcloud' && '☁️ SoundCloud'}
                  {user.auth_provider === 'apple' && '🍎 Apple'}
                  {!['spotify', 'soundcloud', 'apple'].includes(user.auth_provider || '') &&
                    user.auth_provider}
                </div>
              )}
              <Menu as="div" className="relative">
              <Menu.Button className="flex items-center gap-2 rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2 text-sm font-medium text-[color:rgb(var(--votuna-ink)/0.7)] shadow-sm transition hover:shadow-md">
                <span className="relative flex h-8 w-8 items-center justify-center">
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgb(var(--votuna-paper))]">
                    <UserAvatar
                      src={avatarSrc}
                      alt={displayName || 'User avatar'}
                      fallback={getInitials(user)}
                      size={32}
                      className="h-full w-full rounded-full"
                      fallbackClassName="h-full w-full rounded-full bg-transparent text-xs font-semibold text-[color:rgb(var(--votuna-ink)/0.7)]"
                    />
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[rgb(var(--votuna-paper))] bg-emerald-500" />
                </span>
                <span className="max-w-[160px] truncate">{displayName}</span>
                <span className="text-xs text-[color:rgb(var(--votuna-ink)/0.4)]">v</span>
              </Menu.Button>
              <Menu.Items className="absolute right-0 z-50 mt-2 w-52 isolate rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgb(var(--votuna-paper))] p-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)] opacity-100 shadow-xl shadow-black/10 backdrop-blur-0">
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      href="/profile"
                      className={`block rounded-xl px-3 py-2 transition cursor-pointer ${
                        active ? 'bg-[rgb(var(--votuna-accent-soft))] text-[rgb(var(--votuna-ink))]' : ''
                      }`}
                    >
                      Profile
                    </Link>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className={`mt-1 flex w-full items-center rounded-xl px-3 py-2 text-left transition cursor-pointer ${
                        active ? 'bg-red-50 text-red-600' : 'text-[color:rgb(var(--votuna-ink)/0.7)]'
                      }`}
                    >
                      Log out
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Menu>
            </>
          ) : (
            <Button
              onClick={() => setLoginOpen(true)}
              className="rounded-full bg-[rgb(var(--votuna-ink))] px-5 py-2 text-sm font-semibold text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
            >
              {loading ? 'Checking session...' : 'Log in'}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={loginOpen} onClose={setLoginOpen}>
        <DialogPanel className="w-full max-w-md rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgb(var(--votuna-paper))] p-6 shadow-2xl shadow-black/10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                Log in
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--votuna-ink))]">
                Pick a provider
              </h2>
              <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                Connect a provider to continue.
              </p>
            </div>
            <button
              onClick={() => setLoginOpen(false)}
              className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] px-3 py-1 text-xs text-[color:rgb(var(--votuna-ink)/0.5)] transition hover:border-[color:rgb(var(--votuna-ink)/0.2)] hover:text-[color:rgb(var(--votuna-ink)/0.8)]"
            >
              Close
            </button>
          </div>

          <div className="mt-6 space-y-3">
            <Button
              onClick={handleSpotifyLogin}
              className="w-full justify-center rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.14)] bg-[rgba(var(--votuna-paper),0.95)] text-[rgb(var(--votuna-ink))] hover:bg-[rgba(var(--votuna-paper),0.85)]"
            >
              Continue with Spotify
            </Button>
            <Button
              onClick={handleSoundcloudLogin}
              className="w-full justify-center rounded-2xl bg-[rgb(var(--votuna-accent))] text-white hover:bg-orange-600"
            >
              Continue with SoundCloud
            </Button>
          </div>
        </DialogPanel>
      </Dialog>
    </nav>
  )
}
