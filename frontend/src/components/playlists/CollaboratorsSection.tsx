import { API_URL } from '@/lib/api'
import type { PlaylistMember } from '@/types/votuna'
import SectionEyebrow from '@/components/ui/SectionEyebrow'
import SurfaceCard from '@/components/ui/SurfaceCard'
import UserAvatar from '@/components/ui/UserAvatar'

type CollaboratorsSectionProps = {
  members: PlaylistMember[]
  isLoading: boolean
}

const buildAvatarSrc = (member: PlaylistMember) => {
  if (!member.avatar_url) return ''
  const version = encodeURIComponent(member.avatar_url)
  return `${API_URL}/api/v1/users/${member.user_id}/avatar?v=${version}`
}

export default function CollaboratorsSection({ members, isLoading }: CollaboratorsSectionProps) {
  return (
    <SurfaceCard>
      <div className="flex items-center justify-between">
        <div>
          <SectionEyebrow>Collaborators</SectionEyebrow>
          <p className="mt-2 text-sm text-[color:rgb(var(--votuna-ink)/0.7)]">
            Users who have accepted the invite.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">Loading collaborators...</p>
      ) : members.length === 0 ? (
        <p className="mt-4 text-sm text-[color:rgb(var(--votuna-ink)/0.6)]">No collaborators yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {members.map((member) => {
            const avatarSrc = buildAvatarSrc(member)
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
    </SurfaceCard>
  )
}
