import { describe, expect, it } from 'vitest';

import type { Message, NotificationPayload, PublicUser } from '@nestcord/shared';

import type { PermissionsService } from '../common/permissions/permissions.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { RealtimeService } from '../gateway/realtime.service';
import { NotificationsService } from './notifications.service';

const CHANNEL = 'channel-1';
const SERVER = 'server-1';

function user(id: string, username: string): PublicUser {
  return {
    id,
    username,
    displayName: null,
    avatarUrl: null,
    accentColor: null,
    status: 'ONLINE',
  };
}

const ADA = user('user-ada', 'ada');
const GRACE = user('user-grace', 'Grace');

function message(content: string): Message {
  return {
    id: 'message-1',
    channelId: CHANNEL,
    conversationId: null,
    author: ADA,
    content,
    createdAt: '2026-08-12T09:00:00.000Z',
    editedAt: null,
    replyTo: null,
    attachments: [],
    reactions: [],
  };
}

/** The `where` shapes the mention lookup is allowed to use. */
interface UserWhere {
  username?: { in?: string[] };
  OR?: Array<{ username: { equals: string; mode?: 'insensitive' } }>;
}

/**
 * A stand-in for the one query under test, matching **case-sensitively** unless the
 * query asks otherwise — which is what PostgreSQL does with a `username` column, and
 * the whole point of the bug this covers.
 */
/** A stored notification row, as `list` reads it back. */
interface StoredNotification {
  id: string;
  type: 'MENTION' | 'FRIEND_REQUEST' | 'DIRECT_MESSAGE';
  sourceId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/** A friendship row, as far as the notification list cares. */
interface StoredFriendship {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
  requestedBy: string;
  user: PublicUser;
  friend: PublicUser;
}

function buildHarness(
  accounts: PublicUser[],
  stored: StoredNotification[] = [],
  friendships: StoredFriendship[] = [],
) {
  const notified: Array<{ userId: string; payload: NotificationPayload }> = [];
  const created: Array<{ userId: string; type: string; sourceId: string }> = [];

  const prisma = {
    client: {
      friendship: {
        findMany: async ({ where }: { where: { id: { in: string[] }; status?: 'PENDING' } }) =>
          friendships
            .filter((row) => where.id.in.includes(row.id))
            .filter((row) => where.status === undefined || row.status === where.status),
      },

      message: {
        findMany: async () => [],
      },

      user: {
        findMany: async ({ where }: { where: UserWhere }) =>
          accounts
            .filter((account) => {
              if (where.username?.in) return where.username.in.includes(account.username);

              return (where.OR ?? []).some(({ username }) =>
                username.mode === 'insensitive'
                  ? username.equals.toLowerCase() === account.username.toLowerCase()
                  : username.equals === account.username,
              );
            })
            .map((account) => ({ id: account.id })),
      },
      notification: {
        create: async ({ data }: { data: { userId: string; type: string; sourceId: string } }) => {
          created.push(data);

          return { id: `notification-${created.length}`, createdAt: new Date(0) };
        },

        findMany: async () => stored,
      },
    },
  } as unknown as PrismaService;

  const permissions = {
    findChannelViewers: async () => accounts.map((account) => account.id),
  } as unknown as PermissionsService;

  const realtime = {
    notify: (userId: string, payload: NotificationPayload) => notified.push({ userId, payload }),
  } as unknown as RealtimeService;

  return {
    notifications: new NotificationsService(prisma, permissions, realtime),
    created,
    notified,
  };
}

describe('NotificationsService', () => {
  describe('the unread list', () => {
    const request = (id: string): StoredNotification => ({
      id: 'notification-1',
      type: 'FRIEND_REQUEST',
      sourceId: id,
      readAt: null,
      createdAt: new Date(0),
    });

    const friendship = (status: StoredFriendship['status']): StoredFriendship => ({
      id: 'friendship-1',
      status,
      requestedBy: GRACE.id,
      user: GRACE,
      friend: ADA,
    });

    it('shows a friend request that is still waiting to be answered', async () => {
      const { notifications } = buildHarness(
        [ADA, GRACE],
        [request('friendship-1')],
        [friendship('PENDING')],
      );

      const list = await notifications.list(ADA.id);

      expect(list).toMatchObject([{ type: 'FRIEND_REQUEST', actor: GRACE }]);
    });

    /**
     * The row survives being accepted, so nothing else takes the notification down.
     * It offered to accept a request that no longer needs accepting, and sat unread
     * in the bell until the reader cleared everything.
     */
    it('hides a friend request that has already been accepted', async () => {
      const { notifications } = buildHarness(
        [ADA, GRACE],
        [request('friendship-1')],
        [friendship('ACCEPTED')],
      );

      await expect(notifications.list(ADA.id)).resolves.toEqual([]);
    });

    /** Blocking the sender settles it just as firmly, and leaves the row behind too. */
    it('hides a friend request from someone who has since been blocked', async () => {
      const { notifications } = buildHarness(
        [ADA, GRACE],
        [request('friendship-1')],
        [friendship('BLOCKED')],
      );

      await expect(notifications.list(ADA.id)).resolves.toEqual([]);
    });

    /** A withdrawn request deletes its row, and was already handled this way. */
    it('hides a friend request whose row is gone entirely', async () => {
      const { notifications } = buildHarness([ADA, GRACE], [request('friendship-1')], []);

      await expect(notifications.list(ADA.id)).resolves.toEqual([]);
    });
  });

  describe('mentions', () => {
    it('notifies a mention typed in the same case as the username', async () => {
      const { notifications, created } = buildHarness([ADA, GRACE]);

      await notifications.notifyMentions(message('morning @Grace'), SERVER);

      expect(created).toEqual([{ userId: GRACE.id, type: 'MENTION', sourceId: 'message-1' }]);
    });

    /**
     * `mentionMatches` compares names case-insensitively and the client highlights
     * on that basis, so a mention that renders as a mention has to notify. Anything
     * else means the recipient sees their name lit up in the channel and never hears
     * about it.
     */
    it('notifies a mention typed in a different case from the username', async () => {
      const { notifications, created } = buildHarness([ADA, GRACE]);

      await notifications.notifyMentions(message('morning @grace'), SERVER);

      expect(created).toEqual([{ userId: GRACE.id, type: 'MENTION', sourceId: 'message-1' }]);
    });

    /**
     * `username` is unique case-sensitively, so a pair like this is possible. Both
     * are notified, which is the same pair the client highlights the mention for —
     * over-notifying beats leaving one of them wondering why their name lit up.
     */
    it('notifies both accounts when two usernames differ only in case', async () => {
      const lower = user('user-lower', 'nim');
      const upper = user('user-upper', 'Nim');
      const { notifications, created } = buildHarness([ADA, lower, upper]);

      await notifications.notifyMentions(message('morning @NIM'), SERVER);

      expect(created.map((entry) => entry.userId)).toEqual([lower.id, upper.id]);
    });

    it('still notifies nobody for a name with no account behind it', async () => {
      const { notifications, created } = buildHarness([ADA, GRACE]);

      await notifications.notifyMentions(message('morning @nobody'), SERVER);

      expect(created).toEqual([]);
    });

    it('never notifies the author about their own mention of themselves', async () => {
      const { notifications, created } = buildHarness([ADA, GRACE]);

      await notifications.notifyMentions(message('note to @ADA'), SERVER);

      expect(created).toEqual([]);
    });

    it('carries enough to render the notification without a second request', async () => {
      const { notifications, notified } = buildHarness([ADA, GRACE]);

      await notifications.notifyMentions(message('morning @grace'), SERVER);

      expect(notified[0]).toMatchObject({
        userId: GRACE.id,
        payload: { type: 'MENTION', actor: ADA, serverId: SERVER, channelId: CHANNEL },
      });
    });
  });
});
