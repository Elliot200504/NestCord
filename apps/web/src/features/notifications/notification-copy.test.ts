import { describe, expect, it } from 'vitest';

import type { NotificationPayload } from '@nestcord/shared';

import { notificationSummary } from './notification-copy';

function notification(type: NotificationPayload['type']): NotificationPayload {
  return {
    id: 'notification-1',
    type,
    sourceId: 'source-1',
    createdAt: '2026-08-13T09:00:00.000Z',
    actor: null,
    serverId: null,
    channelId: null,
    conversationId: null,
    preview: null,
  };
}

describe('notificationSummary', () => {
  it('says what each kind of notification actually was', () => {
    // All three are created by the API today, and every one of them used to read
    // "mentioned you".
    expect(notificationSummary(notification('MENTION'))).toBe('mentioned you');
    expect(notificationSummary(notification('DIRECT_MESSAGE'))).toBe('sent you a message');
    expect(notificationSummary(notification('FRIEND_REQUEST'))).toBe('sent you a friend request');
  });

  it('has a line for every type the payload allows', () => {
    const types: Array<NotificationPayload['type']> = [
      'MENTION',
      'DIRECT_MESSAGE',
      'FRIEND_REQUEST',
      'SERVER_INVITE',
    ];

    for (const type of types) {
      expect(notificationSummary(notification(type))).toBeTruthy();
    }
  });
});
