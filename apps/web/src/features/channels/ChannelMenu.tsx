import type { ComponentType, ReactNode } from 'react';
import { ContextMenu, DropdownMenu } from 'radix-ui';
import { Plus, Settings, Shield } from 'lucide-react';

import { has, Permission, type Channel } from '@nestcord/shared';

const ITEM =
  'hover:bg-surface-700 focus:bg-surface-700 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none';

const CONTENT = 'bg-popover border-border z-50 w-56 rounded-xl border p-1.5 shadow-xl';

/** Both menu kinds take the same items; this is all either one needs of them. */
type MenuItem = ComponentType<{
  onSelect: () => void;
  className?: string;
  children: ReactNode;
}>;

interface ChannelMenuProps {
  channel: Channel;
  onEdit: () => void;
  /** Only passed for categories, where creating inside makes sense. */
  onCreateInside?: () => void;
  /**
   * `context` opens on right click, which is what a channel row needs: its left
   * click belongs to navigation. `click` is for a category heading, which navigates
   * nowhere, so opening on left click costs nothing.
   */
  trigger?: 'context' | 'click';
  children: ReactNode;
}

/**
 * The actions behind a channel or category. Which ones appear follows the
 * permissions the API resolved for that channel — the checks that matter are
 * re-decided on the server for every request.
 */
export function ChannelMenu({
  channel,
  onEdit,
  onCreateInside,
  trigger = 'context',
  children,
}: ChannelMenuProps) {
  const canManageChannel = has(channel.permissions, Permission.MANAGE_CHANNELS);
  const canManageRoles = has(channel.permissions, Permission.MANAGE_ROLES);

  // With nothing to offer, the trigger stays a plain element rather than a menu
  // that opens onto an empty box.
  if (!canManageChannel && !canManageRoles) return <>{children}</>;

  const items = (Item: MenuItem) => (
    <>
      {canManageChannel && onCreateInside && (
        <Item onSelect={onCreateInside} className={ITEM}>
          <Plus className="size-4" aria-hidden />
          Create channel here
        </Item>
      )}

      <Item onSelect={onEdit} className={ITEM}>
        {canManageChannel ? (
          <Settings className="size-4" aria-hidden />
        ) : (
          <Shield className="size-4" aria-hidden />
        )}
        {canManageChannel
          ? `Edit ${channel.type === 'CATEGORY' ? 'category' : 'channel'}`
          : 'Permissions'}
      </Item>
    </>
  );

  if (trigger === 'click') {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={6} className={CONTENT}>
            {items(DropdownMenu.Item)}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  return (
    <ContextMenu.Root>
      {/* Radix also opens this from the keyboard — the context-menu key or Shift+F10
          on the focused row — so the actions are not mouse-only. */}
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className={CONTENT}>{items(ContextMenu.Item)}</ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
