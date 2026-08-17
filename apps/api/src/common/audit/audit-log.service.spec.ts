import { describe, expect, it } from 'vitest';

import { AUDIT_LOG_PAGE_SIZE, type AuditAction } from '@nestcord/shared';

import type { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

const SERVER = 'server-1';

interface StubEntry {
  id: string;
  action: AuditAction;
  targetId: string | null;
  reason?: string | null;
}

interface HarnessOptions {
  entries?: StubEntry[];
  /** Accounts that still exist. Anyone else resolves to no user. */
  userIds?: string[];
  /** Makes the write fail, so the swallowing can be tested. */
  failWrites?: boolean;
}

function buildHarness(options: HarnessOptions = {}) {
  const { entries = [], userIds = [], failWrites = false } = options;

  const created: Record<string, unknown>[] = [];
  const queries: Record<string, unknown>[] = [];
  const lookups: string[][] = [];

  const prisma = {
    client: {
      auditLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          if (failWrites) throw new Error('database is down');

          created.push(data);
          return data;
        },
        findMany: async (query: Record<string, unknown>) => {
          queries.push(query);

          return entries.map((entry) => ({
            id: entry.id,
            action: entry.action,
            targetId: entry.targetId,
            reason: entry.reason ?? null,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            actor: publicUser('mod'),
          }));
        },
      },
      user: {
        findMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          lookups.push(where.id.in);

          return where.id.in.filter((id) => userIds.includes(id)).map(publicUser);
        },
      },
    },
  } as unknown as PrismaService;

  return { audit: new AuditLogService(prisma), created, queries, lookups };
}

function publicUser(id: string) {
  return {
    id,
    username: id,
    displayName: null,
    avatarUrl: null,
    accentColor: null,
    status: 'OFFLINE' as const,
  };
}

describe('AuditLogService.record', () => {
  it('stores the entry with its nulls filled in', async () => {
    const { audit, created } = buildHarness();

    await audit.record({ serverId: SERVER, actorId: 'mod', action: 'MEMBER_KICK' });

    expect(created).toEqual([
      { serverId: SERVER, actorId: 'mod', action: 'MEMBER_KICK', targetId: null, reason: null },
    ]);
  });

  /**
   * The action being logged has already happened. Failing the request afterwards
   * would tell a moderator their kick did not work when it did.
   */
  it('swallows a write failure rather than failing the action it describes', async () => {
    const { audit } = buildHarness({ failWrites: true });

    await expect(
      audit.record({ serverId: SERVER, actorId: 'mod', action: 'MEMBER_BAN', targetId: 'target' }),
    ).resolves.toBeUndefined();
  });
});

describe('AuditLogService.list', () => {
  it('breaks ties on id, so a page boundary cannot skip or repeat an entry', async () => {
    const { audit, queries } = buildHarness();

    await audit.list(SERVER);

    expect(queries[0]?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(queries[0]?.take).toBe(AUDIT_LOG_PAGE_SIZE);
  });

  it('steps past the cursor rather than returning it again', async () => {
    const { audit, queries } = buildHarness();

    await audit.list(SERVER, 'entry-50');

    expect(queries[0]).toMatchObject({ cursor: { id: 'entry-50' }, skip: 1 });
  });

  it('asks for no cursor on the first page', async () => {
    const { audit, queries } = buildHarness();

    await audit.list(SERVER);

    expect(queries[0]).not.toHaveProperty('cursor');
  });

  it('resolves the target of a member action to the user it names', async () => {
    const { audit } = buildHarness({
      entries: [{ id: 'entry-1', action: 'MEMBER_BAN', targetId: 'target' }],
      userIds: ['target'],
    });

    const [entry] = await audit.list(SERVER);

    expect(entry?.targetUser?.id).toBe('target');
    expect(entry?.targetId).toBe('target');
  });

  it('leaves the target of a channel action unresolved, since it is not a user', async () => {
    const { audit, lookups } = buildHarness({
      entries: [{ id: 'entry-1', action: 'CHANNEL_DELETE', targetId: 'channel-9' }],
      userIds: ['channel-9'],
    });

    const [entry] = await audit.list(SERVER);

    // Never looked up at all: a channel id is not a user id, and one that happens to
    // match an account must not be shown as a person.
    expect(lookups).toEqual([]);
    expect(entry?.targetUser).toBeNull();
    expect(entry?.targetId).toBe('channel-9');
  });

  it('keeps the entry when the target account is gone', async () => {
    const { audit } = buildHarness({
      entries: [{ id: 'entry-1', action: 'MEMBER_KICK', targetId: 'deleted-user' }],
      userIds: [],
    });

    const [entry] = await audit.list(SERVER);

    expect(entry?.targetUser).toBeNull();
    expect(entry?.targetId).toBe('deleted-user');
  });

  it('looks each person up once, however many entries name them', async () => {
    const { audit, lookups } = buildHarness({
      entries: [
        { id: 'entry-1', action: 'MEMBER_BAN', targetId: 'target' },
        { id: 'entry-2', action: 'MEMBER_UNBAN', targetId: 'target' },
        { id: 'entry-3', action: 'MEMBER_KICK', targetId: 'other' },
      ],
      userIds: ['target', 'other'],
    });

    await audit.list(SERVER);

    expect(lookups).toEqual([['target', 'other']]);
  });

  it('does not go looking for users when no entry names one', async () => {
    const { audit, lookups } = buildHarness({
      entries: [{ id: 'entry-1', action: 'ROLE_CREATE', targetId: 'role-1' }],
    });

    await audit.list(SERVER);

    expect(lookups).toEqual([]);
  });
});
