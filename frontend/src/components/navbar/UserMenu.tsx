'use client'

import { Menu } from '@headlessui/react'
import Link from 'next/link'
import UserAvatar from '@/components/ui/UserAvatar'

type UserMenuProps = {
  displayName: string
  avatarSrc: string
  onLogout: () => void | Promise<void>
}

const getMenuItemClassName = (
  active: boolean,
  tone: 'default' | 'danger' = 'default',
) => {
  const base = 'block cursor-pointer rounded-xl px-3 py-2 transition'
  if (!active) {
    return `${base} ${tone === 'danger' ? 'text-[color:rgb(var(--votuna-ink)/0.7)]' : ''}`.trim()
  }
  if (tone === 'danger') return `${base} bg-red-50 text-red-600`
  return `${base} bg-[rgb(var(--votuna-accent-soft))] text-[rgb(var(--votuna-ink))]`
}

const getInitials = (displayName: string) => {
  if (!displayName) return 'U'
  return displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function UserMenu({
  displayName,
  avatarSrc,
  onLogout,
}: UserMenuProps) {
  return (
    <Menu as="div" className="relative">
      <Menu.Button className="flex items-center gap-2 rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.7)] px-4 py-2 text-sm font-medium text-[color:rgb(var(--votuna-ink)/0.7)] shadow-sm transition hover:shadow-md">
        <span className="relative flex h-8 w-8 items-center justify-center">
          <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgb(var(--votuna-paper))]">
            <UserAvatar
              src={avatarSrc}
              alt={displayName || 'User avatar'}
              fallback={getInitials(displayName)}
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
            <Link href="/profile" className={getMenuItemClassName(active)}>
              Profile
            </Link>
          )}
        </Menu.Item>
        <Menu.Item>
          {({ active }) => (
            <button
              onClick={onLogout}
              className={`mt-1 w-full text-left ${getMenuItemClassName(active, 'danger')}`}
            >
              Log out
            </button>
          )}
        </Menu.Item>
      </Menu.Items>
    </Menu>
  )
}
