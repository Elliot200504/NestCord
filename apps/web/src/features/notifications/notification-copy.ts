import type { NotificationPayload } from '@nestcord/shared';

/**
 * What a notification says happened, after the actor's name.
 *
 * Its own module because the bell renders a component and a helper beside one breaks
 * fast refresh for the file — the same reason `message-anchor.ts` sits apart.
 *
 * Every type the API can create has a line here. A mention, a DM and a friend request
 * are three different things, and one wording for all of them tells two thirds of
 * people the wrong story about why they were interrupted.
 */
const SUMMARIES: Record<NotificationPayload['type'], string> = {
  MENTION: 'mentioned you',
  DIRECT_MESSAGE: 'sent you a message',
  FRIEND_REQUEST: 'sent you a friend request',
  SERVER_INVITE: 'invited you to a server',
};

export function notificationSummary(notification: NotificationPayload): string {
  return SUMMARIES[notification.type];
}
