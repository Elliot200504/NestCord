import { describe, expect, it } from 'vitest';

import type { Message, NotificationPayload } from '@nestcord/shared';

import type { PermissionsService } from '../common/permissions/permissions.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { RealtimeService } from '../gateway/realtime.service';
import { NotificationsService } from './notifications.service';

const SERVER = 'server-1';
const CHANNEL = 'channel-1';
const AUTHOR = 'user-author';

/** Enough of a user row for the mention lookup to work on. */
interface StubUser {
  id: string;
  username: string;
}

interface UsernameFilter {
  equals?: string;
  in?: string[];
  mode?: 'default' | 'insensitive';
}

interface UserWhere {
  username?: UsernameFilter;
  OR?: Array<{ username: UsernameFilter }>;
}

/**
 * PostgreSQL compares a text column exactly unless the query asks for
 * `mode: 'insensitive'`, so the stub does the same — what is under test is whether
 * the service asks a question that can find the account it meant.
 */
function matchesFilter(username: string, filter: UsernameFilter): boolean {
  const fold = (value: string) => (filter.mode === 'insensitive' ? value.toLowerCase() : value);
  const wanted = filter.in ?? (filter.equals === undefined ? [] : [filter.equals]);

  return wanted.some((candidate) => fold(candidate) === fold(username));
}

function matchesWhere(username: string, where: UserWhere): boolean {
  if (where.OR) return where.OR.some((clause) => matchesFilter(username, clause.username));

  return where.username ? matchesFilter(username, where.username) : false;
}

function message(content: string): Message {
  return {
    id: 'message-1',
    channelId: CHANNEL,
    conversationId: null,
    author: {
      id: AUTHOR,
      username: 'author',
      displayName: null,
      avatarUrl: null,
      accentColor: null,
      status: 'ONLINE',
    },
    content,
    createdAt: '2026-08-12T09:00:00.000Z',
    editedAt: null,
    replyTo: null,
    attachments: [],
    reactions: [],
  };
}

/** Records what would have been written and broadcast rather than doing either. */
function buildHarness(options: { users?: StubUser[]; viewers?: string[] } = {}) {
  const users = options.users ?? [];
  const viewers = options.viewers ?? [];
  const notified: Array<{ userId: string; payload: NotificationPayload }> = [];
  const rows: Array<{ userId: string; type: string; sourceId: string }> = [];
  let nextId = 1;

  const prisma = {
    client: {
      user: {
        findMany: async ({ where }: { where: UserWhere }) =>
          users
            .filter((user) => matchesWhere(user.username, where))
            .map((user) => ({ id: user.id })),
      },

      notification: {
        create: async ({ data }: { data: { userId: string; type: string; sourceId: string } }) => {
          rows.push(data);

          return {
            id: `notification-${nextId++}`,
            type: data.type,
            sourceId: data.sourceId,
            readAt: null,
            createdAt: new Date('2026-08-12T09:00:00Z'),
          };
        },
      },
    },
  } as unknown as PrismaService;

  const permissions = {
    findChannelViewers: async () => viewers,
  } as unknown as PermissionsService;

  const realtime = {
    notify: (userId: string, payload: NotificationPayload) => notified.push({ userId, payload }),
  } as unknown as RealtimeService;

  return {
    notifications: new NotificationsService(prisma, permissions, realtime),
    notified,
    rows,
  };
}

describe('NotificationsService.notifyMentions', () => {
  it('notifies a mentioned user whose name was typed with different capitals', async () => {
    // The client resolves mentions without case, so this renders as a real mention.
    // An exact lookup would leave a pill on screen that had notified nobody.
    const { notifications, notified } = buildHarness({
      users: [{ id: 'user-ada', username: 'Ada' }],
      viewers: [AUTHOR, 'user-ada'],
    });

    await notifications.notifyMentions(message('morning @ada'), SERVER);

    expect(notified.map((entry) => entry.userId)).toEqual(['user-ada']);
  });

  it('notifies a mention typed exactly as the account is spelled', async () => {
    const { notifications, notified } = buildHarness({
      users: [{ id: 'user-ada', username: 'ada' }],
      viewers: [AUTHOR, 'user-ada'],
    });

    await notifications.notifyMentions(message('morning @ada'), SERVER);

    expect(notified.map((entry) => entry.userId)).toEqual(['user-ada']);
  });

  it('leaves out a mentioned member who cannot see the channel', async () => {
    const { notifications, notified } = buildHarness({
      users: [{ id: 'user-ada', username: 'Ada' }],
      viewers: [AUTHOR],
    });

    await notifications.notifyMentions(message('@Ada are you there'), SERVER);

    expect(notified).toEqual([]);
  });

  it('does not notify the author for mentioning themselves', async () => {
    const { notifications, notified } = buildHarness({
      users: [{ id: AUTHOR, username: 'Author' }],
      viewers: [AUTHOR],
    });

    await notifications.notifyMentions(message('note to @author'), SERVER);

    expect(notified).toEqual([]);
  });

  it('notifies nobody for a name no account has', async () => {
    const { notifications, notified, rows } = buildHarness({
      users: [{ id: 'user-ada', username: 'Ada' }],
      viewers: [AUTHOR, 'user-ada'],
    });

    await notifications.notifyMentions(message('hello @nobody'), SERVER);

    expect(notified).toEqual([]);
    expect(rows).toEqual([]);
  });

  it('records a row and a broadcast carrying a preview of the message', async () => {
    const { notifications, notified, rows } = buildHarness({
      users: [{ id: 'user-ada', username: 'Ada' }],
      viewers: [AUTHOR, 'user-ada'],
    });

    await notifications.notifyMentions(message('@Ada look at this'), SERVER);

    expect(rows).toEqual([{ userId: 'user-ada', type: 'MENTION', sourceId: 'message-1' }]);
    expect(notified[0]?.payload).toMatchObject({
      type: 'MENTION',
      sourceId: 'message-1',
      serverId: SERVER,
      channelId: CHANNEL,
      preview: '@Ada look at this',
    });
  });
});
