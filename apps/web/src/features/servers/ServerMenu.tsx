import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { DropdownMenu } from 'radix-ui';
import { LogOut, Settings, Trash2, UserPlus } from 'lucide-react';

import { has, Permission, type Server } from '@nestcord/shared';

import { useCurrentUser } from '@/features/auth/use-auth';
import { MENU_MOTION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui-store';
import { useDeleteServer, useLeaveServer } from './use-servers';

const ITEM =
  'hover:bg-surface-700 focus:bg-surface-700 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none';

/**
 * The actions behind the server name. Which ones appear follows the permissions the
 * API resolved — the owner sees delete, everyone else sees leave.
 */
export function ServerMenu({ server, children }: { server: Server; children: ReactNode }) {
  const openModal = useUiStore((state) => state.openModal);
  const leave = useLeaveServer();
  const remove = useDeleteServer();
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const isOwner = me?.id === server.ownerId;

  const canInvite = has(server.permissions, Permission.MANAGE_SERVER);
  const canOpenSettings =
    has(server.permissions, Permission.MANAGE_SERVER) ||
    has(server.permissions, Permission.MANAGE_ROLES);

  async function goHome() {
    await navigate({
      to: '/app/$serverId/$channelId',
      params: { serverId: '@me', channelId: 'friends' },
    });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className={cn(
            'bg-popover border-border z-50 w-56 rounded-xl border p-1.5 shadow-xl',
            MENU_MOTION,
          )}
        >
          {canInvite && (
            <DropdownMenu.Item onSelect={() => openModal('invite')} className={ITEM}>
              <UserPlus className="size-4" aria-hidden />
              Invite people
            </DropdownMenu.Item>
          )}

          {canOpenSettings && (
            <DropdownMenu.Item onSelect={() => openModal('server-settings')} className={ITEM}>
              <Settings className="size-4" aria-hidden />
              Server settings
            </DropdownMenu.Item>
          )}

          {isOwner ? (
            <DropdownMenu.Item
              onSelect={() => {
                remove.mutate(server.id, { onSuccess: () => void goHome() });
              }}
              className={cn(ITEM, 'text-destructive')}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete server
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item
              onSelect={() => {
                leave.mutate(server.id, { onSuccess: () => void goHome() });
              }}
              className={cn(ITEM, 'text-destructive')}
            >
              <LogOut className="size-4" aria-hidden />
              Leave server
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
