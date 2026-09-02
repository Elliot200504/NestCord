import { describe, expect, it } from 'vitest';

import { DEFAULT_EVERYONE_PERMISSIONS, Permission } from '@nestcord/shared';

import type { AuditLogService, AuditRecord } from '../common/audit/audit-log.service';
import { OWNER_POSITION, type MemberContext } from '../common/permissions/member-context';
import type { PermissionsService } from '../common/permissions/permissions.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { RealtimeService } from '../gateway/realtime.service';
import { MembersService } from './members.service';

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

const TARGET = member({ userId: 'target', memberId: 'member-target', highestPosition: 1 });

interface Harness {
  members: MembersService;
  deletedMemberIds: string[];
  updates: Array<{ id: string; nickname?: string | null }>;
  broadcasts: Array<{ serverId: string; userId: string }>;
  records: AuditRecord[];
}

function buildHarness(known: MemberContext[] = [member(), TARGET]): Harness {
  const deletedMemberIds: string[] = [];
  const updates: Harness['updates'] = [];
  const broadcasts: Harness['broadcasts'] = [];
  const records: AuditRecord[] = [];

  const row = (nickname: string | null = null) => ({
    nickname,
    joinedAt: new Date('2026-01-01T00:00:00Z'),
    user: {
      id: 'target',
      username: 'target',
      displayName: null,
      avatarUrl: null,
      accentColor: null,
      status: 'OFFLINE' as const,
    },
    roles: [{ roleId: 'everyone' }],
  });

  const prisma = {
    client: {
      serverMember: {
        delete: async ({ where }: { where: { id: string } }) => {
          deletedMemberIds.push(where.id);

          return {};
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { nickname?: string | null };
        }) => {
          updates.push({ id: where.id, ...data });

          return row(data.nickname ?? null);
        },
      },
    },
  } as unknown as PrismaService;

  const permissions = {
    findMemberContext: async (serverId: string, userId: string) =>
      known.find((entry) => entry.serverId === serverId && entry.userId === userId) ?? null,
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
    members: new MembersService(prisma, permissions, realtime, audit),
    deletedMemberIds,
    updates,
    broadcasts,
    records,
  };
}

describe('MembersService', () => {
  describe('kick', () => {
    it('removes the membership, announces it and records the reason', async () => {
      const harness = buildHarness();

      await harness.members.kick(member(), 'target', 'Spam');

      expect(harness.deletedMemberIds).toEqual(['member-target']);
      expect(harness.broadcasts).toEqual([{ serverId: SERVER, userId: 'target' }]);
      expect(harness.records).toEqual([
        {
          serverId: SERVER,
          actorId: 'mod',
          action: 'MEMBER_KICK',
          targetId: 'target',
          reason: 'Spam',
        },
      ]);
    });

    it('records no reason when none was given', async () => {
      const harness = buildHarness();

      await harness.members.kick(member(), 'target');

      expect(harness.records[0]?.reason).toBeNull();
    });

    it('refuses to kick someone who is not a member', async () => {
      const harness = buildHarness([member()]);

      await expect(harness.members.kick(member(), 'stranger')).rejects.toThrow(
        'That user is not a member of this server',
      );
      expect(harness.deletedMemberIds).toEqual([]);
    });

    it('refuses to kick yourself, pointing at leave instead', async () => {
      const harness = buildHarness();

      await expect(harness.members.kick(member(), 'mod')).rejects.toThrow(
        'Use leave rather than kicking yourself',
      );
      expect(harness.deletedMemberIds).toEqual([]);
    });

    it('refuses to kick a member of equal rank', async () => {
      const equal = member({ userId: 'peer', memberId: 'member-peer', highestPosition: 5 });
      const harness = buildHarness([member(), equal]);

      await expect(harness.members.kick(member(), 'peer')).rejects.toThrow(
        'That member is the same rank as you or higher',
      );
      expect(harness.deletedMemberIds).toEqual([]);
    });

    it('refuses to kick a member of higher rank', async () => {
      const boss = member({ userId: 'boss', memberId: 'member-boss', highestPosition: 9 });
      const harness = buildHarness([member(), boss]);

      await expect(harness.members.kick(member(), 'boss')).rejects.toThrow(
        'That member is the same rank as you or higher',
      );
      expect(harness.deletedMemberIds).toEqual([]);
    });

    it('refuses to kick the owner, whatever the actor holds', async () => {
      const owner = member({
        userId: 'owner',
        memberId: 'member-owner',
        isOwner: true,
        highestPosition: OWNER_POSITION,
      });
      const admin = member({ permissions: Permission.ADMINISTRATOR });
      const harness = buildHarness([admin, owner]);

      await expect(harness.members.kick(admin, 'owner')).rejects.toThrow(
        'That member is the same rank as you or higher',
      );
      expect(harness.deletedMemberIds).toEqual([]);
    });

    it('lets the owner kick anyone', async () => {
      const owner = member({
        userId: 'owner',
        memberId: 'member-owner',
        isOwner: true,
        highestPosition: OWNER_POSITION,
      });
      const harness = buildHarness([owner, TARGET]);

      await harness.members.kick(owner, 'target');

      expect(harness.deletedMemberIds).toEqual(['member-target']);
    });

    it('does not announce or record anything when the kick is refused', async () => {
      const harness = buildHarness();

      await expect(harness.members.kick(member(), 'mod')).rejects.toThrow();

      expect(harness.broadcasts).toEqual([]);
      expect(harness.records).toEqual([]);
    });
  });

  describe('update', () => {
    it('lets a member set their own nickname with no permission at all', async () => {
      const harness = buildHarness();

      await harness.members.update(member(), 'mod', { nickname: 'Moddy' });

      expect(harness.updates).toEqual([{ id: 'member-mod', nickname: 'Moddy' }]);
    });

    it('refuses to rename someone else without MANAGE_SERVER', async () => {
      const harness = buildHarness();

      await expect(
        harness.members.update(member(), 'target', { nickname: 'Renamed' }),
      ).rejects.toThrow('You cannot change other members’ nicknames');
      expect(harness.updates).toEqual([]);
    });

    it('renames someone else with MANAGE_SERVER and the hierarchy on your side', async () => {
      const manager = member({ permissions: Permission.MANAGE_SERVER });
      const harness = buildHarness([manager, TARGET]);

      await harness.members.update(manager, 'target', { nickname: 'Renamed' });

      expect(harness.updates).toEqual([{ id: 'member-target', nickname: 'Renamed' }]);
    });

    it('refuses to rename a member of equal or higher rank even with MANAGE_SERVER', async () => {
      const manager = member({ permissions: Permission.MANAGE_SERVER });
      const peer = member({ userId: 'peer', memberId: 'member-peer', highestPosition: 5 });
      const harness = buildHarness([manager, peer]);

      await expect(
        harness.members.update(manager, 'peer', { nickname: 'Renamed' }),
      ).rejects.toThrow('That member is the same rank as you or higher');
      expect(harness.updates).toEqual([]);
    });

    it('refuses to rename someone who is not a member', async () => {
      const manager = member({ permissions: Permission.MANAGE_SERVER });
      const harness = buildHarness([manager]);

      await expect(
        harness.members.update(manager, 'stranger', { nickname: 'Renamed' }),
      ).rejects.toThrow('That user is not a member of this server');
    });

    it('leaves the nickname alone when the field is absent', async () => {
      const harness = buildHarness();

      await harness.members.update(member(), 'mod', {});

      expect(harness.updates).toEqual([{ id: 'member-mod' }]);
    });
  });
});
