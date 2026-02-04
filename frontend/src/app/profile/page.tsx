'use client'

import { Button, Card, Select, SelectItem, TextInput } from '@tremor/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { apiJson, apiJsonOrNull, API_URL } from '../../lib/api'

type User = {
  id?: number
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
  avatar_url?: string | null
  auth_provider?: string | null
}

type ThemeSetting = 'light' | 'dark' | 'system'

type UserSettings = {
  theme: ThemeSetting
  receive_emails: boolean
}

const THEME_STORAGE_KEY = 'votuna-theme'

/** Profile page for the authenticated user. */
export default function ProfilePage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    display_name: '',
  })
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<Record<string, string>>({})
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarStatus, setAvatarStatus] = useState('')
  const [settingsForm, setSettingsForm] = useState<UserSettings>({
    theme: 'system',
    receive_emails: true,
  })
  const [settingsStatus, setSettingsStatus] = useState('')

  const userQuery = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiJsonOrNull<User>('/api/v1/users/me'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const user = userQuery.data ?? null

  const settingsQuery = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => apiJson<UserSettings>('/api/v1/users/me/settings', { authRequired: true }),
    enabled: !!user?.id,
    refetchInterval: 60_000,
    staleTime: 60_000,
  })
  const settings = settingsQuery.data ?? null

  const avatarSrc = user?.avatar_url
    ? `${API_URL}/api/v1/users/me/avatar?v=${encodeURIComponent(user.avatar_url)}`
    : ''

  /** Sync form values from the latest user payload. */
  const syncForm = (payload: User | null) => {
    if (!payload) return
    setForm({
      email: payload.email ?? '',
      first_name: payload.first_name ?? '',
      last_name: payload.last_name ?? '',
      display_name: payload.display_name ?? '',
    })
  }

  const syncSettingsForm = (payload: UserSettings | null) => {
    if (!payload) return
    setSettingsForm({
      theme: payload.theme,
      receive_emails: payload.receive_emails,
    })
  }

  useEffect(() => {
    syncForm(user)
  }, [user])

  useEffect(() => {
    if (!settings) return
    syncSettingsForm(settings)
    localStorage.setItem(THEME_STORAGE_KEY, settings.theme)
  }, [settings])

  const saveFieldMutation = useMutation({
    mutationFn: async ({ field, value }: { field: keyof typeof form; value: string }) => {
      const payload = { [field]: value.trim() === '' ? null : value.trim() }
      return apiJson<User>('/api/v1/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify(payload),
      })
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['currentUser'], updated)
      window.dispatchEvent(new CustomEvent('votuna:user-updated', { detail: updated }))
    },
  })

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiJson<User>('/api/v1/users/me/avatar', {
        method: 'POST',
        authRequired: true,
        body: formData,
      })
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['currentUser'], updated)
      window.dispatchEvent(new CustomEvent('votuna:user-updated', { detail: updated }))
    },
  })

  const settingsMutation = useMutation({
    mutationFn: async (payload: UserSettings) => {
      return apiJson<UserSettings>('/api/v1/users/me/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        authRequired: true,
        body: JSON.stringify(payload),
      })
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['userSettings'], updated)
      localStorage.setItem(THEME_STORAGE_KEY, updated.theme)
      window.dispatchEvent(new CustomEvent('votuna:settings-updated', { detail: updated }))
    },
  })

  /** Update a single profile field. */
  const saveField = async (field: keyof typeof form) => {
    setSaving((prev) => ({ ...prev, [field]: true }))
    setStatus((prev) => ({ ...prev, [field]: '' }))
    try {
      const updated = await saveFieldMutation.mutateAsync({ field, value: form[field] })
      syncForm(updated)
      setStatus((prev) => ({ ...prev, [field]: 'Saved' }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save'
      setStatus((prev) => ({ ...prev, [field]: message }))
    } finally {
      setSaving((prev) => ({ ...prev, [field]: false }))
    }
  }

  /** Update a form field and clear any prior status message. */
  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setStatus((prev) => ({ ...prev, [field]: '' }))
  }

  /** Upload a new avatar file for the current user. */
  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true)
    setAvatarStatus('')
    try {
      const updated = await avatarMutation.mutateAsync(file)
      syncForm(updated)
      setAvatarStatus('Avatar updated')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to upload avatar'
      setAvatarStatus(message)
    } finally {
      setAvatarUploading(false)
    }
  }

  /** Handle avatar file selection. */
  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    void handleAvatarUpload(file)
    event.target.value = ''
  }

  const updateSettingsField = <K extends keyof UserSettings>(field: K, value: UserSettings[K]) => {
    setSettingsForm((prev) => ({ ...prev, [field]: value }))
    setSettingsStatus('')
  }

  const saveSettings = async () => {
    if (!settings) return
    setSettingsStatus('')
    try {
      await settingsMutation.mutateAsync(settingsForm)
      setSettingsStatus('Settings saved')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save settings'
      setSettingsStatus(message)
    }
  }

  /** Normalize form values for comparison. */
  const normalize = (value: string | null | undefined) => (value ?? '').trim()
  /** Determine whether a field has unsaved edits. */
  const isDirty = (field: keyof typeof form) => normalize(form[field]) !== normalize(user?.[field])

  const settingsDirty =
    !!settings &&
    (settingsForm.theme !== settings.theme ||
      settingsForm.receive_emails !== settings.receive_emails)

  if (userQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
          <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading profile...</p>
        </Card>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
          <h1 className="text-2xl font-semibold text-[rgb(var(--votuna-ink))]">You are not signed in</h1>
          <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
            Head back to the homepage and connect with SoundCloud to see your profile.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center rounded-full bg-[rgb(var(--votuna-ink))] px-4 py-2 text-sm font-semibold text-[rgb(var(--votuna-paper))]"
          >
            Back to home
          </Link>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="fade-up space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
            Profile
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[rgb(var(--votuna-ink))]">Welcome back</h1>
        </div>
        <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgb(var(--votuna-paper))]">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[color:rgb(var(--votuna-ink)/0.6)]">
                    ?
                  </div>
                )}
              </div>
              <div className="min-w-[220px] flex-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                  Avatar
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onAvatarChange}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
                  >
                    {avatarUploading ? 'Uploading...' : 'Upload avatar'}
                  </Button>
                </div>
                {avatarStatus ? (
                  <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                    {avatarStatus}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                  Display name
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <TextInput
                    value={form.display_name}
                    onValueChange={(value) => updateField('display_name', value)}
                    className="bg-[rgba(var(--votuna-paper),0.85)] text-[rgb(var(--votuna-ink))]"
                  />
                  {isDirty('display_name') ? (
                    <Button
                      onClick={() => saveField('display_name')}
                      disabled={saving.display_name}
                      className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
                    >
                      {saving.display_name ? 'Saving...' : 'Save'}
                    </Button>
                  ) : null}
                </div>
                {status.display_name ? (
                  <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                    {status.display_name}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                  Provider
                </p>
                <p className="mt-3 text-base font-semibold text-[rgb(var(--votuna-ink))]">
                  {user.auth_provider ?? '-'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                  First name
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <TextInput
                    value={form.first_name}
                    onValueChange={(value) => updateField('first_name', value)}
                    className="bg-[rgba(var(--votuna-paper),0.85)] text-[rgb(var(--votuna-ink))]"
                  />
                  {isDirty('first_name') ? (
                    <Button
                      onClick={() => saveField('first_name')}
                      disabled={saving.first_name}
                      className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
                    >
                      {saving.first_name ? 'Saving...' : 'Save'}
                    </Button>
                  ) : null}
                </div>
                {status.first_name ? (
                  <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                    {status.first_name}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                  Last name
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <TextInput
                    value={form.last_name}
                    onValueChange={(value) => updateField('last_name', value)}
                    className="bg-[rgba(var(--votuna-paper),0.85)] text-[rgb(var(--votuna-ink))]"
                  />
                  {isDirty('last_name') ? (
                    <Button
                      onClick={() => saveField('last_name')}
                      disabled={saving.last_name}
                      className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
                    >
                      {saving.last_name ? 'Saving...' : 'Save'}
                    </Button>
                  ) : null}
                </div>
                {status.last_name ? (
                  <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                    {status.last_name}
                  </p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                  Email
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TextInput
                    value={form.email}
                    onValueChange={(value) => updateField('email', value)}
                    className="min-w-[220px] flex-1 bg-[rgba(var(--votuna-paper),0.85)] text-[rgb(var(--votuna-ink))]"
                  />
                  {isDirty('email') ? (
                    <Button
                      onClick={() => saveField('email')}
                      disabled={saving.email}
                      className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
                    >
                      {saving.email ? 'Saving...' : 'Save'}
                    </Button>
                  ) : null}
                </div>
                {status.email ? (
                  <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">{status.email}</p>
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.9)] p-6 shadow-xl shadow-black/5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                Settings
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--votuna-ink))]">
                Personal preferences
              </h2>
              <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                Control the way Votuna looks and whether we send you emails.
              </p>
            </div>
            <Button
              onClick={saveSettings}
              disabled={!settingsDirty || settingsMutation.isPending || settingsQuery.isLoading}
              className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
            >
              {settingsMutation.isPending ? 'Saving...' : 'Save settings'}
            </Button>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                Theme
              </p>
              <div className="mt-2">
                <Select
                  value={settingsForm.theme}
                  onValueChange={(value) => updateSettingsField('theme', value as ThemeSetting)}
                  className="relative z-20 w-full"
                >
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </Select>
              </div>
              <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                Match your OS preference or force a theme.
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                Emails
              </p>
              <label className="mt-3 flex items-center gap-3 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                <input
                  type="checkbox"
                  checked={settingsForm.receive_emails}
                  onChange={(event) => updateSettingsField('receive_emails', event.target.checked)}
                  className="h-5 w-5 rounded border-[color:rgb(var(--votuna-ink)/0.2)] text-[rgb(var(--votuna-accent))]"
                />
                Receive product updates and notifications.
              </label>
            </div>
          </div>
          {settingsStatus ? (
            <p className="mt-4 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">{settingsStatus}</p>
          ) : null}
          {settingsQuery.isLoading ? (
            <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">Loading settings...</p>
          ) : null}
        </Card>
      </div>
    </main>
  )
}
