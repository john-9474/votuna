'use client'

import { Dialog, DialogPanel, Subtitle, Text, TextInput } from '@tremor/react'
import { useState } from 'react'

import { API_URL } from '@/lib/api'
import type { usePlaylistInvites } from '@/lib/hooks/playlistDetail/usePlaylistInvites'
import type { usePlaylistMembers } from '@/lib/hooks/playlistDetail/usePlaylistMembers'
import type { PlaylistMember } from '@/lib/types/votuna'
import AppButton from '@/components/ui/AppButton'
import AppLinkButton from '@/components/ui/AppLinkButton'
import AppPanelRow from '@/components/ui/AppPanelRow'
import AppSectionHeader from '@/components/ui/AppSectionHeader'
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
      <AppSectionHeader
        eyebrow="Collaborators"
        description="People already collaborating and pending invites."
        actions={
          <>
            {memberActions.canLeavePlaylist ? (
              <AppButton
                intent="danger"
                onClick={memberActions.leave.run}
                disabled={memberActions.leave.isPending}
              >
                {memberActions.leave.isPending ? 'Leaving...' : 'Leave playlist'}
              </AppButton>
            ) : null}
            {invites.canInvite ? <AppButton onClick={invites.modal.open}>Invite</AppButton> : null}
          </>
        }
      />

      {isLoading ? (
        <Text className="mt-4">Loading collaborators...</Text>
      ) : members.length === 0 ? (
        <Text className="mt-4">No collaborators yet.</Text>
      ) : (
        <div className="mt-4 space-y-3">
          {members.map((member) => {
            const avatarSrc = buildMemberAvatarSrc(member)
            const canRemoveMember = memberActions.canManageMembers && member.role !== 'owner'
            const isRemovingMember =
              memberActions.remove.isPending &&
              memberActions.remove.removingMemberUserId === member.user_id
            return (
              <AppPanelRow key={member.user_id} className="flex items-center justify-between">
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
                      <Text className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                        {member.display_name || 'Unknown user'}
                      </Text>
                    )}
                    <Text className="text-xs">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </Text>
                  </div>
                </div>
                <div className="text-right">
                  <Text className="text-xs">
                    {member.suggested_count} suggested
                  </Text>
                  <SectionEyebrow compact>{member.role}</SectionEyebrow>
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
              </AppPanelRow>
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
          <Text className="mt-4">Loading pending invites...</Text>
        ) : invites.pendingUserInvites.length > 0 ? (
          <div className="mt-5 border-t border-[color:rgb(var(--votuna-ink)/0.08)] pt-4">
            <AppSectionHeader eyebrow="Invited (pending)" className="gap-0" descriptionClassName="mt-0" />
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
                  <AppPanelRow key={invite.id} className="flex items-center justify-between">
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
                          <Text className="text-sm font-semibold text-[rgb(var(--votuna-ink))]">{displayName}</Text>
                        )}
                        <Text className="text-xs">
                          {handle ? `@${handle} - ` : ''}
                          Invited {new Date(invite.created_at).toLocaleDateString()}
                        </Text>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <SectionEyebrow compact tone="strong">Invited</SectionEyebrow>
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
                  </AppPanelRow>
                )
              })}
            </div>
          </div>
        ) : null
      ) : null}

      <Dialog open={invites.modal.isOpen} onClose={invites.modal.close}>
        <DialogPanel className="w-full max-w-2xl p-6">
          <AppSectionHeader
            eyebrow="Invite collaborator"
            title="Find a user"
            description="Search by name or user ID and select a result to send an invite."
            actions={
              <AppButton intent="ghost" onClick={invites.modal.close}>
                Close
              </AppButton>
            }
            className="items-start"
          />

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
                <AppPanelRow
                  key={`${candidate.source}:${candidate.provider_user_id}`}
                  className="flex flex-wrap items-center justify-between gap-3 bg-[rgba(var(--votuna-paper),0.85)]"
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
                      <Text className="truncate text-sm font-semibold text-[rgb(var(--votuna-ink))]">
                        {candidate.display_name || candidate.username || candidate.provider_user_id}
                      </Text>
                      <Text className="truncate text-xs">
                        @{candidate.username || candidate.provider_user_id}
                      </Text>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {candidate.profile_url ? (
                      <AppLinkButton
                        href={candidate.profile_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        intent="outline"
                      >
                        View profile
                      </AppLinkButton>
                    ) : null}
                    <AppButton
                      onClick={() => invites.invite.sendToCandidate(candidate)}
                      disabled={invites.invite.isSending}
                    >
                      {invites.invite.isSending ? 'Inviting...' : 'Invite'}
                    </AppButton>
                  </div>
                </AppPanelRow>
              ))}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-[color:rgb(var(--votuna-ink)/0.1)] p-4">
            <Subtitle>Or share an invite link.</Subtitle>
            {invites.search.hasSearched && invites.search.results.length === 0 ? (
              <Text className="mt-2 text-xs">
                No users found for that search, so a link is the best option.
              </Text>
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
                <Text className="text-xs">Invite link</Text>
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
