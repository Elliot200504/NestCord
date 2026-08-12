import type { ReactNode } from 'react';
import { DropdownMenu } from 'radix-ui';
import { Plus, Settings, Shield } from 'lucide-react';

import { has, Permission, type Channel } from '@nestcord/shared';

const ITEM =
  'hover:bg-surface-700 focus:bg-surface-700 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none';

/**
 * The actions behind a channel or category. Which ones appear follows the
 * permissions the API resolved for that channel — the checks that matter are
 * re-decided on the server for every request.
 */
export function ChannelMenu({
  channel,
  onEdit,
  onCreateInside,
  children,
}: {
  channel: Channel;
  onEdit: () => void;
  /** Only passed for categories, where creating inside makes sense. */
  onCreateInside?: () => void;
  children: ReactNode;
}) {
  const canManageChannel = has(channel.permissions, Permission.MANAGE_CHANNELS);
  const canManageRoles = has(channel.permissions, Permission.MANAGE_ROLES);

  // With nothing to offer, the trigger stays a plain element rather than a menu
  // that opens onto an empty box.
  if (!canManageChannel && !canManageRoles) return <>{children}</>;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="bg-popover border-border z-50 w-56 rounded-xl border p-1.5 shadow-xl"
        >
          {canManageChannel && onCreateInside && (
            <DropdownMenu.Item onSelect={onCreateInside} className={ITEM}>
              <Plus className="size-4" aria-hidden />
              Create channel here
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Item onSelect={onEdit} className={ITEM}>
            {canManageChannel ? (
              <Settings className="size-4" aria-hidden />
            ) : (
              <Shield className="size-4" aria-hidden />
            )}
            {canManageChannel
              ? `Edit ${channel.type === 'CATEGORY' ? 'category' : 'channel'}`
              : 'Permissions'}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
