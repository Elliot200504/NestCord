import { placeholderMembers } from '../features/placeholder-data';
import { cn } from '@/lib/utils';
import { UserAvatar } from './UserAvatar';

export function MemberList() {
  const online = placeholderMembers.filter((member) => member.status !== 'OFFLINE');
  const offline = placeholderMembers.filter((member) => member.status === 'OFFLINE');

  return (
    <aside
      aria-label="Members"
      className="bg-surface-800 border-border hidden w-60 shrink-0 overflow-y-auto border-l px-2 py-4 lg:block"
    >
      {[
        { label: `Here now — ${online.length}`, members: online },
        { label: `Away — ${offline.length}`, members: offline },
      ].map((group) => (
        <section key={group.label} className="mb-5">
          <h2 className="text-content-500 px-2.5 pb-1.5 text-xs font-medium">{group.label}</h2>
          <ul>
            {group.members.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  className={cn(
                    'hover:bg-surface-700 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-opacity transition-colors',
                    // Offline members stay listed but stop competing for attention.
                    member.status === 'OFFLINE' && 'opacity-45 hover:opacity-100',
                  )}
                >
                  <UserAvatar user={member} size="md" status={member.status} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {member.displayName ?? member.username}
                  </span>
                  {member.role !== 'Member' && (
                    <span className="text-content-500 text-xs">{member.role}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}
