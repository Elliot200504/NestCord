import type { Server, ServerMember, ServerRole } from '@nestcord/shared';

import { useCurrentUser } from '@/features/auth/use-auth';
import { useMediaQuery, SHELL_ROOMY } from '@/hooks/useMediaQuery';
import { memberName } from '@/features/servers/member-name';
import { MemberMenu } from '@/features/servers/MemberMenu';
import { useActiveServerId } from '@/features/servers/useActiveServer';
import { useMembers, useServer } from '@/features/servers/use-servers';
import { cn } from '@/lib/utils';
import { ShellPanel } from './ShellPanel';
import { UserAvatar } from './UserAvatar';
import { useUiStore } from '@/stores/ui-store';

export function MemberList() {
  const serverId = useActiveServerId();

  const { data: members, isPending, isError } = useMembers(serverId);
  const { data: server } = useServer(serverId);
  const { data: me } = useCurrentUser();

  // Only from `lg` up is there room for a third column; below that the list comes
  // in over the messages instead.
  const roomy = useMediaQuery(SHELL_ROOMY);
  const memberListOpen = useUiStore((state) => state.memberListOpen);
  const drawer = useUiStore((state) => state.drawer);
  const closeDrawer = useUiStore((state) => state.closeDrawer);

  if (serverId === null) return null;

  // The moderator's own row, which is where their rank in this server comes from.
  const viewer = members?.find((member) => member.user.id === me?.id);

  const online = members?.filter((member) => member.user.status !== 'OFFLINE') ?? [];
  const offline = members?.filter((member) => member.user.status === 'OFFLINE') ?? [];

  return (
    <ShellPanel
      side="right"
      wide={roomy}
      visible={roomy ? memberListOpen : drawer === 'members'}
      onClose={closeDrawer}
      label="Member list"
      closeLabel="Close the member list"
    >
      <aside
        aria-label="Members"
        className="border-border flex-1 overflow-y-auto px-2 py-4 lg:border-l"
      >
        {isPending && (
          <ul aria-label="Loading members" className="space-y-2 px-2.5">
            {[0, 1, 2, 3, 4].map((slot) => (
              <li key={slot} className="flex items-center gap-2.5">
                <span className="bg-surface-700/60 size-8 animate-pulse rounded-full" />
                <span className="bg-surface-700/60 h-3 flex-1 animate-pulse rounded" />
              </li>
            ))}
          </ul>
        )}

        {isError && (
          <p role="alert" className="text-destructive px-2.5 text-sm">
            Could not load the member list.
          </p>
        )}

        {members &&
          [
            { label: `Here now — ${online.length}`, members: online },
            { label: `Away — ${offline.length}`, members: offline },
          ].map((group) => (
            <section key={group.label} className="mb-5">
              <h2 className="text-content-500 px-2.5 pb-1.5 text-xs font-medium">{group.label}</h2>
              <ul>
                {group.members.map((member) => (
                  <li key={member.user.id}>
                    <MemberRow member={member} server={server} viewer={viewer} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </aside>
    </ShellPanel>
  );
}

function MemberRow({
  member,
  server,
  viewer,
}: {
  member: ServerMember;
  server: Server | undefined;
  viewer: ServerMember | undefined;
}) {
  const topRole = highestRole(member, server?.roles ?? []);
  const name = memberName(member);

  const row = (
    <button
      type="button"
      className={cn(
        'hover:bg-surface-700 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors transition-opacity',
        // Offline members stay listed but stop competing for attention.
        member.user.status === 'OFFLINE' && 'opacity-45 hover:opacity-100',
      )}
    >
      <UserAvatar user={member.user} size="md" status={member.user.status} />
      <span
        className="min-w-0 flex-1 truncate text-sm"
        // A role colour is the member's colour — that is what makes the list readable.
        style={topRole?.color ? { color: topRole.color } : undefined}
      >
        {name}
      </span>
      {topRole && !topRole.isDefault && (
        <span className="text-content-500 text-xs">{topRole.name}</span>
      )}
    </button>
  );

  // Without the server we cannot resolve what the viewer may do, so the row is
  // just a row until it arrives.
  if (!server) return row;

  return (
    <MemberMenu member={member} server={server} viewer={viewer}>
      {row}
    </MemberMenu>
  );
}

/**
 * The highest-positioned role the member actually holds. `@everyone` is the floor,
 * so it only wins when there is nothing else.
 */
function highestRole(member: ServerMember, roles: ServerRole[]): ServerRole | null {
  const held = roles.filter((role) => member.roleIds.includes(role.id));

  return held.reduce<ServerRole | null>(
    (highest, role) => (highest === null || role.position > highest.position ? role : highest),
    null,
  );
}
