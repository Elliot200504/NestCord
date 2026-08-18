import type { ReactNode } from 'react';
import { DropdownMenu } from 'radix-ui';

import type { CurrentUser, PresenceStatus } from '@nestcord/shared';

import { useUpdateStatus } from '@/features/users/use-users';
import { MENU_MOTION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { PresenceDot } from './PresenceDot';

const CHOICES: ReadonlyArray<{ status: PresenceStatus; label: string; hint?: string }> = [
  { status: 'ONLINE', label: 'Online' },
  { status: 'IDLE', label: 'Idle' },
  { status: 'DO_NOT_DISTURB', label: 'Do not disturb', hint: 'No notifications' },
  { status: 'OFFLINE', label: 'Invisible', hint: 'You will appear offline' },
];

/**
 * The presence picker behind the user panel. Presence is stored on the user for
 * now; the live, connection-driven half arrives with the gateway (PLAN.MD §7).
 */
export function StatusMenu({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const update = useUpdateStatus();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={8}
          className={cn(
            'bg-popover border-border z-50 w-56 rounded-xl border p-1.5 shadow-xl',
            MENU_MOTION,
          )}
        >
          <DropdownMenu.Label className="text-content-500 px-2.5 py-1.5 text-xs">
            Set your status
          </DropdownMenu.Label>

          {CHOICES.map((choice) => (
            <DropdownMenu.Item
              key={choice.status}
              onSelect={() => update.mutate(choice.status)}
              className={cn(
                'hover:bg-surface-700 focus:bg-surface-700 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none',
                user.status === choice.status && 'bg-surface-600',
              )}
            >
              <PresenceDot status={choice.status} className="border-0" />
              <span className="flex-1">{choice.label}</span>
              {choice.hint && (
                <span className="text-content-500 text-[0.65rem]">{choice.hint}</span>
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
