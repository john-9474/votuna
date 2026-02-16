'use client'

import { Col, Grid, Select, SelectItem, Switch, Text } from '@tremor/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'

import EditableProfileField from '@/components/profile/EditableProfileField'
import { queryKeys } from '@/lib/constants/queryKeys'
import AppButton from '@/components/ui/AppButton'
import PageShell from '@/components/ui/PageShell'
import AppRouteButton from '@/components/ui/AppRouteButton'
import AppSectionHeader from '@/components/ui/AppSectionHeader'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import StatusCallout from '@/components/ui/StatusCallout'
import SurfaceCard from '@/components/ui/SurfaceCard'
import UserAvatar from '@/components/ui/UserAvatar'
import { apiJson, API_URL } from '@/lib/api'
import { currentUserQueryKey, useCurrentUser } from '@/lib/hooks/useCurrentUser'
import type { User } from '@/lib/types/user'

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

  const userQuery = useCurrentUser()
  const user = userQuery.data ?? null

  const settingsQuery = useQuery({
    queryKey: queryKeys.userSettings,
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
      queryClient.setQueryData(currentUserQueryKey, updated)
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
      queryClient.setQueryData(currentUserQueryKey, updated)
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
      queryClient.setQueryData(queryKeys.userSettings, updated)
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
      <PageShell maxWidth="4xl">
        <SurfaceCard>
          <Text>Loading profile...</Text>
        </SurfaceCard>
      </PageShell>
    )
  }

  if (!user) {
    return (
      <PageShell maxWidth="4xl">
        <SurfaceCard>
          <h1 className="text-2xl font-semibold text-[rgb(var(--votuna-ink))]">You are not signed in</h1>
          <Text className="mt-2">
            Head back to the homepage and connect with a provider to see your profile.
          </Text>
          <AppRouteButton href="/" intent="solid" className="mt-6 text-sm">
            Back to home
          </AppRouteButton>
        </SurfaceCard>
      </PageShell>
    )
  }

  return (
    <PageShell maxWidth="4xl">
      <div className="fade-up space-y-6">
        <AppSectionHeader eyebrow="Profile" title="Welcome back" />
        <SurfaceCard>
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgb(var(--votuna-paper))]">
                <UserAvatar
                  src={avatarSrc}
                  alt="Avatar"
                  fallback={(user.display_name || user.first_name || user.email || 'U')
                    .slice(0, 1)
                    .toUpperCase()}
                  size={64}
                  className="h-full w-full rounded-none"
                  fallbackClassName="h-full w-full rounded-none bg-transparent text-sm font-semibold text-[color:rgb(var(--votuna-ink)/0.6)]"
                />
              </div>
              <div className="min-w-[220px] flex-1">
                <SectionEyebrow compact>Avatar</SectionEyebrow>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onAvatarChange}
                    className="hidden"
                  />
                  <AppButton
                    intent="primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                  >
                    {avatarUploading ? 'Uploading...' : 'Upload avatar'}
                  </AppButton>
                </div>
                {avatarStatus ? (
                  <Text className="mt-2 text-xs">
                    {avatarStatus}
                  </Text>
                ) : null}
              </div>
            </div>

            <Grid className="gap-6" numItems={1} numItemsSm={2}>
              <EditableProfileField
                label="Display name"
                value={form.display_name}
                onChange={(value) => updateField('display_name', value)}
                isDirty={isDirty('display_name')}
                onSave={() => saveField('display_name')}
                isSaving={saving.display_name}
                status={status.display_name}
              />

              <div>
                <SectionEyebrow compact>Provider</SectionEyebrow>
                <Text className="mt-3 text-base font-semibold text-[rgb(var(--votuna-ink))]">
                  {user.auth_provider ?? '-'}
                </Text>
              </div>

              <EditableProfileField
                label="First name"
                value={form.first_name}
                onChange={(value) => updateField('first_name', value)}
                isDirty={isDirty('first_name')}
                onSave={() => saveField('first_name')}
                isSaving={saving.first_name}
                status={status.first_name}
              />

              <EditableProfileField
                label="Last name"
                value={form.last_name}
                onChange={(value) => updateField('last_name', value)}
                isDirty={isDirty('last_name')}
                onSave={() => saveField('last_name')}
                isSaving={saving.last_name}
                status={status.last_name}
              />

              <Col numColSpanSm={2}>
                <EditableProfileField
                  label="Email"
                  value={form.email}
                  onChange={(value) => updateField('email', value)}
                  isDirty={isDirty('email')}
                  onSave={() => saveField('email')}
                  isSaving={saving.email}
                  status={status.email}
                  rowClassName="flex-wrap"
                  inputClassName="min-w-[220px] flex-1"
                />
              </Col>
            </Grid>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <AppSectionHeader
            eyebrow="Settings"
            title="Personal preferences"
            description="Control the way Votuna looks and whether we send you emails."
            actions={
              <AppButton
                intent="primary"
                onClick={saveSettings}
                disabled={!settingsDirty || settingsMutation.isPending || settingsQuery.isLoading}
              >
                {settingsMutation.isPending ? 'Saving...' : 'Save settings'}
              </AppButton>
            }
            className="items-start"
          />

          <Grid className="mt-6 gap-6" numItems={1} numItemsSm={2}>
            <div>
              <SectionEyebrow compact>Theme</SectionEyebrow>
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
              <Text className="mt-2 text-xs">
                Match your OS preference or force a theme.
              </Text>
            </div>
            <div>
              <SectionEyebrow compact>Emails</SectionEyebrow>
              <label className="mt-3 flex items-center gap-3 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                <Switch
                  checked={settingsForm.receive_emails}
                  onChange={(checked) => updateSettingsField('receive_emails', checked)}
                />
                Receive product updates and notifications.
              </label>
            </div>
          </Grid>
          {settingsStatus ? (
            <StatusCallout tone="info" title="Settings status" className="mt-4">
              {settingsStatus}
            </StatusCallout>
          ) : null}
          {settingsQuery.isLoading ? (
            <Text className="mt-2 text-xs">
              Loading settings...
            </Text>
          ) : null}
        </SurfaceCard>
      </div>
    </PageShell>
  )
}
