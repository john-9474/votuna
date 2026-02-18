'use client'

import { Dialog, DialogPanel, Text } from '@tremor/react'
import AppButton from '@/components/ui/AppButton'
import SectionEyebrow from '@/components/ui/SectionEyebrow'

type LoginProviderDialogProps = {
  open: boolean
  onClose: () => void
  onSpotifyLogin: () => void
  onSoundcloudLogin: () => void
  onAppleLogin: () => void
  onTidalLogin: () => void
}

export default function LoginProviderDialog({
  open,
  onClose,
  onSpotifyLogin,
  onSoundcloudLogin,
  onAppleLogin,
  onTidalLogin,
}: LoginProviderDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogPanel className="w-full max-w-md rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgb(var(--votuna-paper))] p-6 shadow-2xl shadow-black/10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <SectionEyebrow compact>Log in</SectionEyebrow>
            <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--votuna-ink))]">
              Pick a provider
            </h2>
            <Text className="mt-2">
              Connect a provider to continue.
            </Text>
          </div>
          <AppButton intent="ghost" onClick={onClose}>
            Close
          </AppButton>
        </div>

        <div className="mt-6 space-y-3">
          <AppButton intent="secondary" onClick={onSpotifyLogin} className="w-full justify-center rounded-2xl">
            Continue with Spotify
          </AppButton>
          <AppButton
            intent="secondary"
            color="orange"
            onClick={onSoundcloudLogin}
            className="w-full justify-center rounded-2xl"
          >
            Continue with SoundCloud
          </AppButton>
          <AppButton
            intent="secondary"
            onClick={onAppleLogin}
            disabled
            className="w-full justify-center rounded-2xl"
            title="Apple Music login is temporarily disabled"
          >
            Continue with Apple Music (Temporarily disabled)
          </AppButton>
          <AppButton intent="secondary" onClick={onTidalLogin} className="w-full justify-center rounded-2xl">
            Continue with TIDAL
          </AppButton>
        </div>
      </DialogPanel>
    </Dialog>
  )
}
