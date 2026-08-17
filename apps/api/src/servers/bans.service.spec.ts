import { describe, expect, it } from 'vitest';

import { DEFAULT_EVERYONE_PERMISSIONS } from '@nestcord/shared';

import type { AuditLogService, AuditRecord } from '../common/audit/audit-log.service';
import {
  NO_ROLE_POSITION,
  OWNER_POSITION,
  type MemberContext,
} from '../common/permissions/member-context';
import type { PermissionsService } from '../common/permissions/permissions.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { RealtimeService } from '../gateway/realtime.service';
import { BansService } from './bans.service';

const SERVER = 'server-1';

function member(overrides: Partial<MemberContext> = {}): MemberContext {
  return {
    serverId: SERVER,
    memberId: 'member-mod',
    userId: 'mod',
    isOwner: false,
    permissions: DEFAULT_EVERYONE_PERMISSIONS,
    roleIds: ['everyone'],
    highestPosition: 5,
    ...overrides,
  };
}

interface StubBan {
  userId: string;
  reason: string | null;
}

interface HarnessOptions {
  /** Users the server already knows about. */
  members?: MemberContext[];
  bans?: StubBan[];
  /** Accounts that exist at all. Defaults to everyone the test names. */
  userIds?: string[];
}

interface Harness {
  bans: BansService;
  created: Array<{ serverId: string; userId: string; bannedBy: string; reason: string | null }>;
  removedMemberIds: string[];
  deleted: Array<{ serverId: string; userId: string }>;
  broadcasts: Array<{ serverId: string; userId: string }>;
  records: AuditRecord[];
}

function buildHarness(options: HarnessOptions = {}): Harness {
  const { members = [], bans: banRows = [], userIds = ['mod', 'target', 'owner'] } = options;

  const created: Harness['created'] = [];
  const removedMemberIds: string[] = [];
  const deleted: Harness['deleted'] = [];
  const broadcasts: Harness['broadcasts'] = [];
  const records: AuditRecord[] = [];

  const banRow = (userId: string, reason: string | null) => ({
    reason,
    bannedAt: new Date('2026-01-01T00:00:00Z'),
    user: {
      id: userId,
      username: userId,
      displayName: null,
      avatarUrl: null,
      accentColor: null,
      status: 'OFFLINE' as const,
    },
    issuer: null,
  });

  const transactionClient = {
    ban: {
      create: async ({
        data,
      }: {
        data: { serverId: string; userId: string; bannedBy: string; reason: string | null };
      }) => {
        created.push(data);
        return banRow(data.userId, data.reason);
      },
    },
    serverMember: {
      delete: async ({ where }: { where: { id: string } }) => {
        removedMemberIds.push(where.id);
        return {};
      },
    },
  };

  const prisma = {
    client: {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          userIds.includes(where.id) ? { id: where.id } : null,
      },
      ban: {
        findMany: async () => banRows.map((entry) => banRow(entry.userId, entry.reason)),
        findUnique: async ({
          where,
        }: {
          where: { serverId_userId: { serverId: string; userId: string } };
        }) => {
          const found = banRows.find((entry) => entry.userId === where.serverId_userId.userId);
          return found ? { userId: found.userId } : null;
        },
        deleteMany: async ({ where }: { where: { serverId: string; userId: string } }) => {
          const found = banRows.find((entry) => entry.userId === where.userId);
          if (!found) return { count: 0 };

          deleted.push(where);
          return { count: 1 };
        },
      },
      $transaction: async <T>(callback: (tx: typeof transactionClient) => Promise<T>) =>
        callback(transactionClient),
    },
  } as unknown as PrismaService;

  const permissions = {
    findMemberContext: async (serverId: string, userId: string) =>
      members.find((entry) => entry.serverId === serverId && entry.userId === userId) ?? null,
  } as unknown as PermissionsService;

  const realtime = {
    memberLeft: (payload: { serverId: string; userId: string }) => broadcasts.push(payload),
  } as unknown as RealtimeService;

  const audit = {
    record: async (entry: AuditRecord) => {
      records.push(entry);
    },
  } as unknown as AuditLogService;

  return {
    bans: new BansService(prisma, permissions, realtime, audit),
    created,
    removedMemberIds,
    deleted,
    broadcasts,
    records,
  };
}

describe('BansService', () => {
  describe('banning', () => {
    it('removes the membership and records the ban', async () => {
      const target = member({ userId: 'target', memberId: 'member-target', highestPosition: 1 });
      const harness = buildHarness({ members: [member(), target] });

      await harness.bans.create(member(), 'target', { reason: 'Spam' });

      expect(harness.created).toEqual([
        { serverId: SERVER, userId: 'target', bannedBy: 'mod', reason: 'Spam' },
      ]);
      expect(harness.removedMemberIds).toEqual(['member-target']);
      expect(harness.broadcasts).toEqual([{ serverId: SERVER, userId: 'target' }]);
      expect(harness.records).toEqual([
        {
          serverId: SERVER,
          actorId: 'mod',
          action: 'MEMBER_BAN',
          targetId: 'target',
          reason: 'Spam',
        },
      ]);
    });

    it('bans a user who is not a member without touching the member list', async () => {
      const harness = buildHarness({ members: [member()] });

      await harness.bans.create(member(), 'target', {});

      expect(harness.created).toHaveLength(1);
      expect(harness.removedMemberIds).toEqual([]);
      // Nobody left the server, so there is nothing for the member list to hear.
      expect(harness.broadcasts).toEqual([]);
    });

    it('rejects a user account that does not exist', async () => {
      const harness = buildHarness({ userIds: ['mod'] });

      await expect(harness.bans.create(member(), 'ghost', {})).rejects.toMatchObject({
        status: 404,
      });
    });

    it('rejects banning yourself', async () => {
      const harness = buildHarness({ members: [member()] });

      await expect(harness.bans.create(member(), 'mod', {})).rejects.toMatchObject({ status: 400 });
    });

    it('rejects a member of equal rank', async () => {
      const peer = member({ userId: 'target', memberId: 'member-target', highestPosition: 5 });
      const harness = buildHarness({ members: [member(), peer] });

      await expect(harness.bans.create(member(), 'target', {})).rejects.toMatchObject({
        status: 403,
      });
      expect(harness.created).toEqual([]);
    });

    it('rejects banning the owner, even as an administrator', async () => {
      const owner = member({
        userId: 'owner',
        memberId: 'member-owner',
        isOwner: true,
        highestPosition: OWNER_POSITION,
      });
      const admin = member({ highestPosition: 9 });
      const harness = buildHarness({ members: [admin, owner] });

      await expect(harness.bans.create(admin, 'owner', {})).rejects.toMatchObject({ status: 403 });
    });

    it('rejects a user who is already banned', async () => {
      const harness = buildHarness({ bans: [{ userId: 'target', reason: null }] });

      await expect(harness.bans.create(member(), 'target', {})).rejects.toMatchObject({
        status: 409,
      });
      expect(harness.created).toEqual([]);
    });

    it('lets an unranked owner ban anyone', async () => {
      const owner = member({
        userId: 'owner',
        memberId: 'member-owner',
        isOwner: true,
        highestPosition: NO_ROLE_POSITION,
      });
      const target = member({ userId: 'target', memberId: 'member-target', highestPosition: 9 });
      const harness = buildHarness({ members: [owner, target] });

      await harness.bans.create(owner, 'target', {});

      expect(harness.created).toHaveLength(1);
    });
  });

  describe('unbanning', () => {
    it('lifts the ban and records it', async () => {
      const harness = buildHarness({ bans: [{ userId: 'target', reason: 'Spam' }] });

      await harness.bans.remove(member(), 'target');

      expect(harness.deleted).toEqual([{ serverId: SERVER, userId: 'target' }]);
      expect(harness.records).toEqual([
        { serverId: SERVER, actorId: 'mod', action: 'MEMBER_UNBAN', targetId: 'target' },
      ]);
    });

    it('rejects lifting a ban that is not there', async () => {
      const harness = buildHarness();

      await expect(harness.bans.remove(member(), 'target')).rejects.toMatchObject({ status: 404 });
      expect(harness.records).toEqual([]);
    });
  });

  describe('listing', () => {
    it('answers with the banned users and their reasons', async () => {
      const harness = buildHarness({
        bans: [
          { userId: 'target', reason: 'Spam' },
          { userId: 'other', reason: null },
        ],
      });

      const bans = await harness.bans.list(SERVER);

      expect(bans.map((ban) => [ban.user.id, ban.reason])).toEqual([
        ['target', 'Spam'],
        ['other', null],
      ]);
    });
  });
});
