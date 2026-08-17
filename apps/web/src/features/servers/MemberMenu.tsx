import { useState, type ReactNode } from 'react';
import { ContextMenu } from 'radix-ui';
import { Ban, UserMinus } from 'lucide-react';

import {
  has,
  MODERATION_REASON_MAX_LENGTH,
  Permission,
  type Server,
  type ServerMember,
} from '@nestcord/shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FormStatus, TextField } from '@/features/settings/SettingsPrimitives';
import { memberName } from './member-name';
import { useBanMember, useKickMember } from './use-servers';

const ITEM =
  'hover:bg-surface-700 focus:bg-surface-700 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none';

const CONTENT = 'bg-popover border-border z-50 w-56 rounded-xl border p-1.5 shadow-xl';

type Action = 'kick' | 'ban';

interface MemberMenuProps {
  member: ServerMember;
  server: Server;
  /**
   * The signed-in user's own membership. Their roles are what the hierarchy is
   * compared against, and it is how the menu knows not to offer actions against
   * yourself.
   */
  viewer: ServerMember | undefined;
  children: ReactNode;
}

/**
 * Kick and ban, behind a right-click on a member row.
 *
 * Which items appear follows the permissions and the hierarchy the API resolved,
 * because offering an action that is going to come back 403 is worse than not
 * offering it. The server re-decides both on every request regardless.
 */
export function MemberMenu({ member, server, viewer, children }: MemberMenuProps) {
  const [action, setAction] = useState<Action | null>(null);

  const canKick = canModerate(member, server, viewer, Permission.KICK_MEMBERS);
  const canBan = canModerate(member, server, viewer, Permission.BAN_MEMBERS);

  // Nothing to offer: the row stays a plain element rather than a menu that opens
  // onto an empty box.
  if (!canKick && !canBan) return <>{children}</>;

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>

        <ContextMenu.Portal>
          <ContextMenu.Content className={CONTENT}>
            {canKick && (
              <ContextMenu.Item onSelect={() => setAction('kick')} className={ITEM}>
                <UserMinus className="size-4" aria-hidden />
                Kick {memberName(member)}
              </ContextMenu.Item>
            )}

            {canBan && (
              <ContextMenu.Item
                onSelect={() => setAction('ban')}
                className={`${ITEM} text-destructive`}
              >
                <Ban className="size-4" aria-hidden />
                Ban {memberName(member)}
              </ContextMenu.Item>
            )}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {action && (
        <ModerationDialog
          action={action}
          member={member}
          serverId={server.id}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}

/**
 * The confirmation, with the reason that ends up in the audit log. Both actions
 * share it because they ask the same two questions: are you sure, and why.
 */
function ModerationDialog({
  action,
  member,
  serverId,
  onClose,
}: {
  action: Action;
  member: ServerMember;
  serverId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  const kick = useKickMember(serverId);
  const ban = useBanMember(serverId);

  const mutation = action === 'kick' ? kick : ban;
  const name = memberName(member);

  const submit = () => {
    const trimmed = reason.trim();

    mutation.mutate(
      { userId: member.user.id, ...(trimmed ? { reason: trimmed } : {}) },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>
          {action === 'kick' ? 'Kick' : 'Ban'} {name}
        </DialogTitle>
        <DialogDescription>
          {action === 'kick'
            ? `${name} can join again with a new invite.`
            : `${name} will be removed and cannot join again until the ban is lifted.`}
        </DialogDescription>

        <div className="mt-5 space-y-4">
          <TextField
            label="Reason"
            value={reason}
            onChange={setReason}
            placeholder="Optional — shown in the audit log"
            maxLength={MODERATION_REASON_MAX_LENGTH}
            disabled={mutation.isPending}
          />

          <FormStatus isPending={mutation.isPending} error={mutation.error} />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={mutation.isPending}>
              {action === 'kick' ? 'Kick' : 'Ban'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * May the viewer use `permission` on this member?
 *
 * Mirrors the server's rule: never yourself, never the owner, and only somebody
 * whose highest role sits strictly below your own. Rendering only — see the note
 * on `MemberMenu`.
 */
function canModerate(
  member: ServerMember,
  server: Server,
  viewer: ServerMember | undefined,
  permission: number,
): boolean {
  if (viewer === undefined) return false;
  if (member.user.id === viewer.user.id) return false;
  if (member.user.id === server.ownerId) return false;
  if (!has(server.permissions, permission)) return false;

  if (viewer.user.id === server.ownerId) return true;

  return (
    highestPosition(server.roles, viewer.roleIds) > highestPosition(server.roles, member.roleIds)
  );
}

/** The rank hierarchy compares. Below every real role when they hold none. */
function highestPosition(roles: Server['roles'], roleIds: string[]): number {
  return roles
    .filter((role) => roleIds.includes(role.id))
    .reduce((highest, role) => Math.max(highest, role.position), -1);
}
