'use client'

import { Button, Dialog, DialogPanel, TextInput } from '@tremor/react'
import { useState } from 'react'

import { API_URL } from '@/lib/api'
import type { usePlaylistInvites } from '@/lib/hooks/playlistDetail/usePlaylistInvites'
import type { PlaylistMember } from '@/lib/types/votuna'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'
import UserAvatar from '@/components/ui/UserAvatar'

type CollaboratorsSectionProps = {
  members: PlaylistMember[]
  isLoading: boolean
  invites: ReturnType<typeof usePlaylistInvites>
}

const buildMemberAvatarSrc = (member: PlaylistMember) => {
  if (!member.avatar_url) return ''
  const version = encodeURIComponent(member.avatar_url)
  return `${API_URL}/api/v1/users/${member.user_id}/avatar?v=${version}`
}

export default function CollaboratorsSection({
  members,
  isLoading,
  invites,
}: CollaboratorsSectionProps) {
  const [copyStatus, setCopyStatus] = useState('')

  const copyInviteLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopyStatus('Invite link copied.')
    } catch {
      setCopyStatus('Unable to copy automatically. Copy the link manually.')
    }
  }

  return (
    <SurfaceCard>
      <div className="flex items-center justify-between gap-4">
        <div>
          <SectionEyebrow>Collaborators</SectionEyebrow>
          <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
            People already collaborating and pending invites.
          </p>
        </div>
        {invites.canInvite ? (
          <Button
            onClick={invites.modal.open}
            className="rounded-full bg-[rgb(var(--votuna-ink))] text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
          >
            Invite
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading collaborators...</p>
      ) : members.length === 0 ? (
        <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">No collaborators yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {members.map((member) => {
            const avatarSrc = buildMemberAvatarSrc(member)
            return (
              <div
                key={member.user_id}
                className="flex items-center justify-between rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.8)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={avatarSrc}
                    alt={member.display_name || 'Collaborator avatar'}
                    fallback={(member.display_name || 'U').slice(0, 1).toUpperCase()}
                    size={32}
                    className="h-8 w-8 rounded-full"
                    fallbackClassName="h-8 w-8 rounded-full"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                      {member.display_name || 'Unknown user'}
                    </p>
                    <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                    {member.suggested_count} suggested
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                    {member.role}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {invites.canInvite ? (
        invites.isPendingInvitesLoading ? (
          <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading pending invites...</p>
        ) : invites.pendingUserInvites.length > 0 ? (
          <div className="mt-5 border-t border-[color:rgb(var(--votuna-ink)/0.08)] pt-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
              Invited (pending)
            </p>
            {invites.invite.error ? (
              <p className="mt-2 text-xs text-rose-500">{invites.invite.error}</p>
            ) : null}
            {invites.invite.status ? (
              <p className="mt-2 text-xs text-emerald-600">{invites.invite.status}</p>
            ) : null}
            <div className="mt-3 space-y-2">
              {invites.pendingUserInvites.map((invite) => {
                const handle =
                  invite.target_username || invite.target_username_snapshot || invite.target_provider_user_id || ''
                const displayName =
                  invite.target_display_name ||
                  invite.target_username_snapshot ||
                  invite.target_provider_user_id ||
                  'Invited user'
                return (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.8)] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        src={invite.target_avatar_url || ''}
                        alt={displayName}
                        fallback={displayName.slice(0, 1).toUpperCase()}
                        size={32}
                        className="h-8 w-8 rounded-full"
                        fallbackClassName="h-8 w-8 rounded-full"
                      />
                      <div>
                        <p className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">{displayName}</p>
                        <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                          {handle ? `@${handle} • ` : ''}
                          Invited {new Date(invite.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
                        Invited
                      </p>
                      <button
                        type="button"
                        onClick={() => invites.invite.cancelPendingInvite(invite.id)}
                        disabled={invites.invite.isCancelling}
                        aria-label={`Cancel invite for ${displayName}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:rgb(var(--votuna-ink)/0.18)] text-sm font-semibold text-[color:rgb(var(--votuna-ink)/0.75)] transition hover:border-[color:rgb(var(--votuna-ink)/0.35)] hover:text-[rgb(var(--votuna-ink))] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {invites.invite.isCancelling && invites.invite.cancellingInviteId === invite.id
                          ? '...'
                          : '×'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null
      ) : null}

      <Dialog open={invites.modal.isOpen} onClose={invites.modal.close}>
        <DialogPanel className="w-full max-w-2xl rounded-3xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgb(var(--votuna-paper))] p-6 shadow-2xl shadow-black/10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                Invite collaborator
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--votuna-ink))]">
                Find a user by username
              </h2>
              <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                Search by username and select a result to send an invite.
              </p>
            </div>
            <button
              onClick={invites.modal.close}
              className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.1)] px-3 py-1 text-xs text-[color:rgb(var(--votuna-ink)/0.5)] transition hover:border-[color:rgb(var(--votuna-ink)/0.2)] hover:text-[color:rgb(var(--votuna-ink)/0.8)]"
            >
              Close
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <TextInput
              value={invites.search.query}
              onValueChange={invites.search.setQuery}
              placeholder="Search username"
              className="flex-1 bg-[rgba(var(--votuna-paper),0.85)] text-[rgb(var(--votuna-ink))]"
            />
            <Button
              onClick={invites.search.run}
              disabled={invites.search.isLoading}
              className="rounded-full bg-[rgb(var(--votuna-ink))] px-5 text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
            >
              {invites.search.isLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {invites.search.error ? (
            <p className="mt-3 text-xs text-rose-500">{invites.search.error}</p>
          ) : null}
          {invites.invite.error ? <p className="mt-3 text-xs text-rose-500">{invites.invite.error}</p> : null}
          {invites.invite.status ? (
            <p className="mt-3 text-xs text-emerald-600">{invites.invite.status}</p>
          ) : null}

          {invites.search.results.length > 0 ? (
            <div className="mt-4 space-y-2">
              {invites.search.results.map((candidate) => (
                <div
                  key={`${candidate.source}:${candidate.provider_user_id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.08)] bg-[rgba(var(--votuna-paper),0.85)] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      src={candidate.avatar_url || ''}
                      alt={candidate.display_name || candidate.username || candidate.provider_user_id}
                      fallback={(candidate.display_name || candidate.username || 'U')
                        .slice(0, 1)
                        .toUpperCase()}
                      size={32}
                      className="h-8 w-8 rounded-full"
                      fallbackClassName="h-8 w-8 rounded-full"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                        {candidate.display_name || candidate.username || candidate.provider_user_id}
                      </p>
                      <p className="truncate text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">
                        @{candidate.username || candidate.provider_user_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {candidate.profile_url ? (
                      <a
                        href={candidate.profile_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.16)] px-4 py-2 text-xs text-[rgb(var(--votuna-ink))] transition hover:border-[color:rgb(var(--votuna-ink)/0.28)] hover:bg-[rgba(var(--votuna-paper),0.95)]"
                      >
                        View profile
                      </a>
                    ) : null}
                    <Button
                      onClick={() => invites.invite.sendToCandidate(candidate)}
                      disabled={invites.invite.isSending}
                      className="rounded-full bg-[rgb(var(--votuna-ink))] px-4 text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
                    >
                      {invites.invite.isSending ? 'Inviting...' : 'Invite'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] bg-[rgba(var(--votuna-paper),0.85)] p-4">
            <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.72)]">Or share an invite link.</p>
            {invites.search.hasSearched && invites.search.results.length === 0 ? (
              <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.62)]">
                No users found for that search, so a link is the best option.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                onClick={invites.link.create}
                disabled={invites.link.isCreating}
                className="rounded-full bg-[rgb(var(--votuna-ink))] px-4 text-[rgb(var(--votuna-paper))] hover:bg-[color:rgb(var(--votuna-ink)/0.9)]"
              >
                {invites.link.isCreating ? 'Generating...' : 'Generate invite link'}
              </Button>
            </div>
            {invites.link.error ? <p className="mt-3 text-xs text-rose-500">{invites.link.error}</p> : null}
            {invites.link.url ? (
              <div className="mt-3">
                <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">Invite link</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={invites.link.url}
                    readOnly
                    className="w-full rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.12)] bg-[rgba(var(--votuna-paper),0.9)] px-3 py-2 text-xs text-[rgb(var(--votuna-ink))]"
                  />
                  <Button
                    onClick={() => copyInviteLink(invites.link.url)}
                    className="rounded-full border border-[color:rgb(var(--votuna-ink)/0.16)] bg-transparent px-4 text-[rgb(var(--votuna-ink))] hover:bg-[rgba(var(--votuna-paper),0.9)]"
                  >
                    Copy
                  </Button>
                </div>
                {copyStatus ? (
                  <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">{copyStatus}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogPanel>
      </Dialog>
    </SurfaceCard>
  )
}
