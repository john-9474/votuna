'use client'

import { Menu } from '@headlessui/react'
import { Button, Dialog, DialogPanel } from '@tremor/react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type User = {
  id?: number
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
  avatar_url?: string | null
  auth_provider?: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

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
  const [loginOpen, setLoginOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)

  const displayName = useMemo(() => getDisplayName(user), [user])
  const avatarSrc = useMemo(() => {
    if (!user?.avatar_url) return ''
    const version = encodeURIComponent(user.avatar_url)
    return `${API_URL}/api/v1/users/me/avatar?v=${version}`
  }, [user])

  /** Fetch the current user based on the session cookie. */
  const loadUser = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/v1/users/me`, {
        credentials: 'include',
      })
      if (!response.ok) {
        setUser(null)
        return
      }
      const payload = (await response.json()) as User
      setUser(payload)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
    window.addEventListener('focus', loadUser)
    return () => window.removeEventListener('focus', loadUser)
  }, [loadUser])

  /** Start the SoundCloud OAuth flow. */
  const handleSoundcloudLogin = () => {
    window.location.href = `${API_URL}/api/v1/auth/login/soundcloud`
  }

  /** Clear the auth cookie and local session state. */
  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      setUser(null)
    }
  }

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<User | null>).detail
      if (detail) {
        setUser(detail)
      } else {
        loadUser()
      }
    }
    window.addEventListener('votuna:user-updated', handler as EventListener)
    return () => window.removeEventListener('votuna:user-updated', handler as EventListener)
  }, [loadUser])

  return (
    <nav className="sticky top-0 z-40 border-b border-black/5 bg-[rgba(250,248,244,0.9)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[rgb(var(--votuna-accent))] text-white shadow-sm shadow-orange-500/40">
            V
          </span>
          <span className="text-[rgb(var(--votuna-ink))]">Votuna</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:shadow-md">
                <span className="relative flex h-8 w-8 items-center justify-center">
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white">
                    {avatarSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-slate-600">{getInitials(user)}</span>
                    )}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                </span>
                <span className="max-w-[160px] truncate">{displayName}</span>
                <span className="text-xs text-slate-400">▾</span>
              </Menu.Button>
              <Menu.Items className="absolute right-0 mt-2 w-52 rounded-2xl border border-black/5 bg-white/95 p-2 text-sm text-slate-600 shadow-xl shadow-black/5 backdrop-blur">
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      href="/profile"
                      className={`block rounded-xl px-3 py-2 transition ${
                        active ? 'bg-[rgb(var(--votuna-accent-soft))] text-slate-900' : ''
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
                      className={`mt-1 flex w-full items-center rounded-xl px-3 py-2 text-left transition ${
                        active ? 'bg-red-50 text-red-600' : 'text-slate-600'
                      }`}
                    >
                      Log out
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Menu>
          ) : (
            <Button
              onClick={() => setLoginOpen(true)}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {loading ? 'Checking session...' : 'Log in'}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={loginOpen} onClose={setLoginOpen}>
        <DialogPanel className="w-full max-w-md rounded-3xl border border-black/5 bg-white/95 p-6 shadow-2xl shadow-black/10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Log in</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Pick a provider</h2>
              <p className="mt-2 text-sm text-slate-600">
                Spotify is coming soon. SoundCloud is ready when you are.
              </p>
            </div>
            <button
              onClick={() => setLoginOpen(false)}
              className="rounded-full border border-black/10 px-3 py-1 text-xs text-slate-500 transition hover:border-black/20 hover:text-slate-700"
            >
              Close
            </button>
          </div>

          <div className="mt-6 space-y-3">
            <Button
              disabled
              className="w-full justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-400"
            >
              Spotify (soon)
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
