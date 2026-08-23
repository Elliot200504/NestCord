import { Link } from '@tanstack/react-router';
import { DropdownMenu } from 'radix-ui';
import { AtSign, Bell } from 'lucide-react';

import type { NotificationPayload } from '@nestcord/shared';

import { UserAvatar } from '@/components/UserAvatar';
import { MENU_MOTION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { notificationSummary } from './notification-copy';
import { useNotifications, useReadNotifications } from './use-notifications';

/**
 * Everything unread, with a dot when there is any of it (PLAN.MD §20).
 *
 * Opening one takes you where it happened and marks it read, which is the only thing
 * anyone wants from a notification. Where that is depends on the type: a mention has a
 * channel, a DM has a conversation, a friend request has the friends page.
 */
export function NotificationBell() {
  const { data: notifications } = useNotifications();
  const read = useReadNotifications();

  const unread = notifications ?? [];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={
            unread.length > 0 ? `Notifications (${unread.length} unread)` : 'Notifications'
          }
          className="text-content-300 hover:text-content-100 relative transition-colors"
        >
          <Bell className="size-5" aria-hidden />
          {unread.length > 0 && (
            <span className="bg-primary absolute -top-0.5 -right-0.5 size-2 rounded-full" />
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={cn(
            'bg-popover border-border z-50 w-80 rounded-xl border p-1.5 shadow-xl',
            MENU_MOTION,
          )}
        >
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-content-400 text-xs font-medium">Notifications</p>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={() => read.mutate(undefined)}
                className="text-content-400 hover:text-content-100 text-xs transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {unread.length === 0 ? (
            <p className="text-content-500 px-2 py-3 text-sm">Nothing new.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {unread.map((notification) => (
                <li key={notification.id}>
                  <NotificationRow
                    notification={notification}
                    onOpen={() => read.mutate(notification.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: NotificationPayload;
  onOpen: () => void;
}) {
  const name = notification.actor?.displayName ?? notification.actor?.username ?? 'Someone';

  const body = (
    <span className="flex items-start gap-2.5">
      {notification.actor ? (
        <UserAvatar user={notification.actor} size="sm" className="mt-0.5" />
      ) : (
        <AtSign className="text-content-400 mt-0.5 size-4" aria-hidden />
      )}
      <span className="min-w-0">
        <span className="block text-sm">
          <span className="font-medium">{name}</span>
          <span className="text-content-400"> {notificationSummary(notification)}</span>
        </span>
        {notification.preview && (
          <span className="text-content-400 block truncate text-xs">{notification.preview}</span>
        )}
      </span>
    </span>
  );

  const className =
    'hover:bg-surface-700 block w-full rounded-lg px-2 py-2 text-left transition-colors';

  if (notification.serverId && notification.channelId) {
    return (
      <Link
        to="/app/$serverId/$channelId"
        params={{ serverId: notification.serverId, channelId: notification.channelId }}
        onClick={onOpen}
        className={className}
      >
        {body}
      </Link>
    );
  }

  if (notification.conversationId) {
    return (
      <Link
        to="/app/@me/$conversationId"
        params={{ conversationId: notification.conversationId }}
        onClick={onOpen}
        className={className}
      >
        {body}
      </Link>
    );
  }

  if (notification.type === 'FRIEND_REQUEST') {
    return (
      <Link to="/app/@me/friends" onClick={onOpen} className={className}>
        {body}
      </Link>
    );
  }

  // Nothing left to open: a mention whose channel is gone, or one of the types that
  // carries no destination. It still marks read, it just has nowhere to send you.
  return (
    <button type="button" onClick={onOpen} className={className}>
      {body}
    </button>
  );
}
