'use client'

import { Dialog, DialogPanel, TextInput } from '@tremor/react'
import { useState } from 'react'

import { API_URL } from '@/lib/api'
import type { usePlaylistInvites } from '@/lib/hooks/playlistDetail/usePlaylistInvites'
import type { usePlaylistMembers } from '@/lib/hooks/playlistDetail/usePlaylistMembers'
import type { PlaylistMember } from '@/lib/types/votuna'
import AppButton from '@/components/ui/AppButton'
import ClearableTextInput from '@/components/ui/ClearableTextInput'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import StatusCallout from '@/components/ui/StatusCallout'
import SurfaceCard from '@/components/ui/SurfaceCard'
import UserAvatar from '@/components/ui/UserAvatar'

type CollaboratorsSectionProps = {
  members: PlaylistMember[]
  isLoading: boolean
  invites: ReturnType<typeof usePlaylistInvites>
  memberActions: ReturnType<typeof usePlaylistMembers>
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
  memberActions,
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
        <div className="flex items-center gap-2">
          {memberActions.canLeavePlaylist ? (
            <AppButton
              intent="danger"
              onClick={memberActions.leave.run}
              disabled={memberActions.leave.isPending}
            >
              {memberActions.leave.isPending ? 'Leaving...' : 'Leave playlist'}
            </AppButton>
          ) : null}
          {invites.canInvite ? (
            <AppButton onClick={invites.modal.open}>Invite</AppButton>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading collaborators...</p>
      ) : members.length === 0 ? (
        <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">No collaborators yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {members.map((member) => {
            const avatarSrc = buildMemberAvatarSrc(member)
            const canRemoveMember = memberActions.canManageMembers && member.role !== 'owner'
            const isRemovingMember =
              memberActions.remove.isPending &&
              memberActions.remove.removingMemberUserId === member.user_id
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
                    {member.profile_url ? (
                      <a
                        href={member.profile_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-sm font-semibold text-[rgb(var(--votuna-ink))] underline-offset-2 hover:underline"
                      >
                        {member.display_name || 'Unknown user'}
                      </a>
                    ) : (
                      <p className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                        {member.display_name || 'Unknown user'}
                      </p>
                    )}
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
                  {canRemoveMember ? (
                    <AppButton
                      intent="danger"
                      size="xs"
                      className="mt-2"
                      onClick={() => memberActions.remove.run(member.user_id)}
                      disabled={memberActions.remove.isPending}
                    >
                      {isRemovingMember ? 'Removing...' : 'Remove'}
                    </AppButton>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {memberActions.error ? (
        <StatusCallout tone="error" title="Member action failed" className="mt-3">
          {memberActions.error}
        </StatusCallout>
      ) : null}
      {memberActions.status ? (
        <StatusCallout tone="success" title="Member status" className="mt-3">
          {memberActions.status}
        </StatusCallout>
      ) : null}

      {invites.canInvite ? (
        invites.isPendingInvitesLoading ? (
          <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading pending invites...</p>
        ) : invites.pendingUserInvites.length > 0 ? (
          <div className="mt-5 border-t border-[color:rgb(var(--votuna-ink)/0.08)] pt-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.45)]">
              Invited (pending)
            </p>
            {invites.invite.error ? (
              <StatusCallout tone="error" title="Invite failed" className="mt-2">
                {invites.invite.error}
              </StatusCallout>
            ) : null}
            {invites.invite.status ? (
              <StatusCallout tone="success" title="Invite status" className="mt-2">
                {invites.invite.status}
              </StatusCallout>
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
                        {invite.target_profile_url ? (
                          <a
                            href={invite.target_profile_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-sm font-semibold text-[rgb(var(--votuna-ink))] underline-offset-2 hover:underline"
                          >
                            {displayName}
                          </a>
                        ) : (
                          <p className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">{displayName}</p>
                        )}
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
                      <AppButton
                        intent="icon"
                        size="xs"
                        className="h-7 w-7 text-sm"
                        onClick={() => invites.invite.cancelPendingInvite(invite.id)}
                        disabled={invites.invite.isCancelling}
                        aria-label={`Cancel invite for ${displayName}`}
                      >
                        {invites.invite.isCancelling && invites.invite.cancellingInviteId === invite.id
                          ? '...'
                          : 'x'}
                      </AppButton>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null
      ) : null}

      <Dialog open={invites.modal.isOpen} onClose={invites.modal.close}>
        <DialogPanel className="w-full max-w-2xl p-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:rgb(var(--votuna-ink)/0.4)]">
                Invite collaborator
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[rgb(var(--votuna-ink))]">Find a user</h2>
              <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
                Search by name or user ID and select a result to send an invite.
              </p>
            </div>
            <AppButton intent="ghost" onClick={invites.modal.close}>
              Close
            </AppButton>
          </div>

          <form
            className="mt-6 flex flex-wrap items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (invites.search.isLoading) return
              invites.search.run()
            }}
          >
            <ClearableTextInput
              value={invites.search.query}
              onValueChange={invites.search.setQuery}
              placeholder="Search users"
              containerClassName="flex-1"
              clearAriaLabel="Clear user search"
            />
            <AppButton type="submit" disabled={invites.search.isLoading}>
              {invites.search.isLoading ? 'Searching...' : 'Search'}
            </AppButton>
          </form>

          {invites.search.error ? (
            <StatusCallout tone="error" title="Search failed" className="mt-3">
              {invites.search.error}
            </StatusCallout>
          ) : null}
          {invites.invite.error ? (
            <StatusCallout tone="error" title="Invite failed" className="mt-3">
              {invites.invite.error}
            </StatusCallout>
          ) : null}
          {invites.invite.status ? (
            <StatusCallout tone="success" title="Invite status" className="mt-3">
              {invites.invite.status}
            </StatusCallout>
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
                    <AppButton
                      onClick={() => invites.invite.sendToCandidate(candidate)}
                      disabled={invites.invite.isSending}
                    >
                      {invites.invite.isSending ? 'Inviting...' : 'Invite'}
                    </AppButton>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] p-4">
            <p className="text-sm text-[color:rgb(var(--votuna-ink)/0.72)]">Or share an invite link.</p>
            {invites.search.hasSearched && invites.search.results.length === 0 ? (
              <p className="mt-2 text-xs text-[color:rgb(var(--votuna-ink)/0.62)]">
                No users found for that search, so a link is the best option.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <AppButton onClick={invites.link.create} disabled={invites.link.isCreating}>
                {invites.link.isCreating ? 'Generating...' : 'Generate invite link'}
              </AppButton>
            </div>
            {invites.link.error ? (
              <StatusCallout tone="error" title="Invite link" className="mt-3">
                {invites.link.error}
              </StatusCallout>
            ) : null}
            {invites.link.url ? (
              <div className="mt-3">
                <p className="text-xs text-[color:rgb(var(--votuna-ink)/0.6)]">Invite link</p>
                <div className="mt-2 flex items-center gap-2">
                  <TextInput value={invites.link.url} readOnly />
                  <AppButton intent="secondary" onClick={() => copyInviteLink(invites.link.url)}>
                    Copy
                  </AppButton>
                </div>
                {copyStatus ? (
                  <StatusCallout tone="info" title="Copy status" className="mt-2">
                    {copyStatus}
                  </StatusCallout>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogPanel>
      </Dialog>
    </SurfaceCard>
  )
}
