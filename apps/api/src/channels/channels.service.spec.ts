import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import { ALL_PERMISSIONS, DEFAULT_EVERYONE_PERMISSIONS, Permission } from '@nestcord/shared';

import type { AuditLogService, AuditRecord } from '../common/audit/audit-log.service';
import { NO_ROLE_POSITION, OWNER_POSITION } from '../common/permissions/member-context';
import type { MemberContext } from '../common/permissions/member-context';
import { PermissionsService } from '../common/permissions/permissions.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { RealtimeService } from '../gateway/realtime.service';
import { VoiceStateService } from '../gateway/voice-state.service';
import { ChannelsService } from './channels.service';

const SERVER = 'server-1';
const EVERYONE_ROLE = 'role-everyone';
const MOD_ROLE = 'role-mod';

interface StubOverride {
  channelId: string;
  type: 'ROLE' | 'MEMBER';
  roleId: string | null;
  userId: string | null;
  allow: number;
  deny: number;
}

interface StubChannel {
  id: string;
  serverId: string;
  name: string;
  type: 'TEXT' | 'VOICE' | 'CATEGORY';
  topic: string | null;
  position: number;
  parentId: string | null;
}

interface StubRole {
  id: string;
  serverId: string;
  position: number;
  isDefault: boolean;
}

function channel(overrides: Partial<StubChannel> = {}): StubChannel {
  return {
    id: 'channel-1',
    serverId: SERVER,
    name: 'general',
    type: 'TEXT',
    topic: null,
    position: 0,
    parentId: null,
    ...overrides,
  };
}

function member(overrides: Partial<MemberContext> = {}): MemberContext {
  return {
    serverId: SERVER,
    memberId: 'member-1',
    userId: 'user-1',
    isOwner: false,
    permissions: DEFAULT_EVERYONE_PERMISSIONS,
    roleIds: [EVERYONE_ROLE],
    highestPosition: 0,
    ...overrides,
  };
}

const ROLES: StubRole[] = [
  { id: EVERYONE_ROLE, serverId: SERVER, position: 0, isDefault: true },
  { id: MOD_ROLE, serverId: SERVER, position: 1, isDefault: false },
];

/** The one `serverMember.findMany` filter the service asks for. */
interface RoleFilter {
  some: { roleId: string };
}

interface Harness {
  channels: ChannelsService;
  voice: VoiceStateService;
  evicted: { channelId: string; userId: string }[];
  /** Users whose socket rooms were recomputed after a permission change. */
  resynced: string[];
  rows: StubChannel[];
  overrides: StubOverride[];
  created: Record<string, unknown>[];
  updated: Record<string, unknown>[];
  deleted: string[];
  audited: AuditRecord[];
}

/**
 * Records writes instead of performing them: the rules are what is under test, not
 * the queries — see the note in `common/testing/fake-prisma.ts`.
 */
function buildHarness(rows: StubChannel[], overrides: StubOverride[], members: MemberContext[]) {
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const deleted: string[] = [];
  let nextId = 1;

  const withOverrides = (row: StubChannel) => ({
    ...row,
    overrides: overrides
      .filter((entry) => entry.channelId === row.id)
      .map((entry) => ({
        type: entry.type,
        roleId: entry.roleId,
        userId: entry.userId,
        allow: entry.allow,
        deny: entry.deny,
        role: entry.roleId
          ? { isDefault: ROLES.find((role) => role.id === entry.roleId)?.isDefault ?? false }
          : null,
      })),
  });

  const prisma = {
    client: {
      channel: {
        findMany: async ({ where }: { where: { serverId: string; parentId?: string | null } }) =>
          rows
            .filter((row) => row.serverId === where.serverId)
            .filter((row) => where.parentId === undefined || row.parentId === where.parentId)
            .map(withOverrides),

        findFirst: async ({
          where,
          orderBy,
        }: {
          where: { id?: string; serverId?: string; type?: string; parentId?: string | null };
          orderBy?: { position?: 'asc' | 'desc' };
        }) => {
          const found = rows
            .filter((row) => (where.id === undefined ? true : row.id === where.id))
            .filter((row) =>
              where.serverId === undefined ? true : row.serverId === where.serverId,
            )
            .filter((row) => (where.type === undefined ? true : row.type === where.type))
            .filter((row) =>
              where.parentId === undefined ? true : row.parentId === where.parentId,
            )
            // `nextPosition` asks for the highest position, so the ordering is part
            // of what the query means and the stub has to honour it.
            .sort((a, b) =>
              orderBy?.position === 'desc' ? b.position - a.position : a.position - b.position,
            );

          return found[0] ? withOverrides(found[0]) : null;
        },

        create: async ({ data }: { data: Omit<StubChannel, 'id'> }) => {
          const row: StubChannel = { ...data, id: `channel-new-${nextId++}` };
          created.push({ ...data });
          rows.push(row);

          return withOverrides(row);
        },

        update: async ({ where, data }: { where: { id: string }; data: Partial<StubChannel> }) => {
          const index = rows.findIndex((row) => row.id === where.id);
          if (index === -1) throw new Error(`No channel ${where.id}`);

          const next = { ...rows[index], ...data } as StubChannel;
          rows[index] = next;
          updated.push({ id: where.id, ...data });

          return withOverrides(next);
        },

        delete: async ({ where }: { where: { id: string } }) => {
          deleted.push(where.id);
          return { id: where.id };
        },
      },

      channelPermission: {
        findMany: async ({ where }: { where: { channelId: string } }) =>
          overrides.filter((entry) => entry.channelId === where.channelId),

        upsert: async ({
          where,
          create,
          update,
        }: {
          where: {
            channelId_roleId?: { channelId: string; roleId: string };
            channelId_userId?: { channelId: string; userId: string };
          };
          create: StubOverride;
          update: { allow: number; deny: number };
        }) => {
          const key = where.channelId_roleId ?? where.channelId_userId;
          const existing = overrides.find(
            (entry) =>
              entry.channelId === key?.channelId &&
              (where.channelId_roleId
                ? entry.roleId === where.channelId_roleId.roleId
                : entry.userId === where.channelId_userId?.userId),
          );

          if (existing) {
            Object.assign(existing, update);
            return existing;
          }

          const row: StubOverride = {
            channelId: create.channelId,
            type: create.type,
            roleId: create.roleId ?? null,
            userId: create.userId ?? null,
            allow: create.allow,
            deny: create.deny,
          };
          overrides.push(row);

          return row;
        },

        deleteMany: async ({
          where,
        }: {
          where: { channelId: string; roleId?: string; userId?: string };
        }) => {
          const doomed = overrides.filter(
            (entry) =>
              entry.channelId === where.channelId &&
              (where.roleId === undefined || entry.roleId === where.roleId) &&
              (where.userId === undefined || entry.userId === where.userId),
          );

          doomed.forEach((entry) => overrides.splice(overrides.indexOf(entry), 1));

          return { count: doomed.length };
        },
      },

      role: {
        findFirst: async ({ where }: { where: { id: string; serverId: string } }) =>
          ROLES.find((role) => role.id === where.id && role.serverId === where.serverId) ?? null,
      },

      serverMember: {
        findUnique: async ({
          where,
        }: {
          where: { serverId_userId: { serverId: string; userId: string } };
        }) => {
          const { serverId, userId } = where.serverId_userId;
          const found = members.find(
            (entry) => entry.serverId === serverId && entry.userId === userId,
          );

          if (!found) return null;

          return {
            id: found.memberId,
            userId: found.userId,
            serverId: found.serverId,
            server: { ownerId: found.isOwner ? found.userId : 'owner-user' },
            roles: found.roleIds.map((id) => ({
              role: {
                id,
                permissions: found.permissions,
                position: ROLES.find((role) => role.id === id)?.position ?? 0,
              },
            })),
          };
        },

        findMany: async ({ where }: { where: { serverId: string; roles?: RoleFilter } }) => {
          const roleId = where.roles?.some.roleId;

          return members
            .filter((entry) => entry.serverId === where.serverId)
            .filter((entry) => roleId === undefined || entry.roleIds.includes(roleId))
            .map((entry) => ({ userId: entry.userId }));
        },
      },
    },
  } as unknown as PrismaService;

  const permissions = new PermissionsService(prisma);

  const audited: AuditRecord[] = [];
  const audit = {
    record: async (entry: AuditRecord) => {
      audited.push(entry);
    },
  } as unknown as AuditLogService;

  const voice = new VoiceStateService();
  const evicted: { channelId: string; userId: string }[] = [];
  const resynced: string[] = [];
  const realtime = {
    voiceEvict: (channelId: string, userId: string) => {
      evicted.push({ channelId, userId });
      voice.leaveUser(userId);
    },
    resyncRooms: (userId: string) => resynced.push(userId),
  } as unknown as RealtimeService;

  return {
    channels: new ChannelsService(prisma, permissions, audit, voice, realtime),
    voice,
    evicted,
    resynced,
    rows,
    overrides,
    created,
    updated,
    deleted,
    audited,
  } satisfies Harness;
}

describe('ChannelsService', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = buildHarness(
      [
        channel({ id: 'category-1', name: 'Text Channels', type: 'CATEGORY' }),
        channel({ id: 'channel-general', name: 'general', parentId: 'category-1' }),
        channel({ id: 'channel-staff', name: 'staff', parentId: 'category-1', position: 1 }),
      ],
      [],
      [member()],
    );
  });

  describe('list', () => {
    it('returns every channel a plain member can see', async () => {
      const channels = await harness.channels.list(member());

      expect(channels.map((entry) => entry.name)).toEqual(['Text Channels', 'general', 'staff']);
    });

    it('hides a channel where @everyone is denied VIEW_CHANNEL', async () => {
      harness.overrides.push({
        channelId: 'channel-staff',
        type: 'ROLE',
        roleId: EVERYONE_ROLE,
        userId: null,
        allow: 0,
        deny: Permission.VIEW_CHANNEL,
      });

      const channels = await harness.channels.list(member());

      expect(channels.map((entry) => entry.id)).not.toContain('channel-staff');
    });

    it('shows a hidden channel again to a member allowed by a role override', async () => {
      harness.overrides.push(
        {
          channelId: 'channel-staff',
          type: 'ROLE',
          roleId: EVERYONE_ROLE,
          userId: null,
          allow: 0,
          deny: Permission.VIEW_CHANNEL,
        },
        {
          channelId: 'channel-staff',
          type: 'ROLE',
          roleId: MOD_ROLE,
          userId: null,
          allow: Permission.VIEW_CHANNEL,
          deny: 0,
        },
      );

      const mod = member({ roleIds: [EVERYONE_ROLE, MOD_ROLE], highestPosition: 1 });
      const channels = await harness.channels.list(mod);

      expect(channels.map((entry) => entry.id)).toContain('channel-staff');
    });

    it('reports the permissions left after an override, not the server-level ones', async () => {
      harness.overrides.push({
        channelId: 'channel-general',
        type: 'ROLE',
        roleId: EVERYONE_ROLE,
        userId: null,
        allow: 0,
        deny: Permission.SEND_MESSAGES,
      });

      const channels = await harness.channels.list(member());
      const general = channels.find((entry) => entry.id === 'channel-general');

      expect(general?.permissions).toBeDefined();
      expect((general?.permissions ?? 0) & Permission.SEND_MESSAGES).toBe(0);
    });

    it('shows the owner everything, whatever the overrides say', async () => {
      harness.overrides.push({
        channelId: 'channel-staff',
        type: 'ROLE',
        roleId: EVERYONE_ROLE,
        userId: null,
        allow: 0,
        deny: Permission.VIEW_CHANNEL,
      });

      const owner = member({
        userId: 'owner-user',
        isOwner: true,
        permissions: ALL_PERMISSIONS,
        highestPosition: OWNER_POSITION,
      });

      const channels = await harness.channels.list(owner);

      expect(channels).toHaveLength(3);
    });
  });

  describe('create', () => {
    const manager = () =>
      member({
        permissions: DEFAULT_EVERYONE_PERMISSIONS | Permission.MANAGE_CHANNELS,
        roleIds: [EVERYONE_ROLE, MOD_ROLE],
        highestPosition: 1,
      });

    it('slugifies a text channel name', async () => {
      const created = await harness.channels.create(manager(), { name: 'Bug Reports!' });

      expect(created.name).toBe('bug-reports');
    });

    it('keeps a category name as typed', async () => {
      const created = await harness.channels.create(manager(), {
        name: 'Voice Rooms',
        type: 'CATEGORY',
      });

      expect(created.name).toBe('Voice Rooms');
    });

    it('audits a new channel against its creator', async () => {
      const created = await harness.channels.create(manager(), { name: 'bug-reports' });

      expect(harness.audited).toEqual([
        {
          serverId: SERVER,
          actorId: manager().userId,
          action: 'CHANNEL_CREATE',
          targetId: created.id,
        },
      ]);
    });

    it('rejects a name with nothing usable in it', async () => {
      await expect(harness.channels.create(manager(), { name: '???' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses to nest a category inside another', async () => {
      await expect(
        harness.channels.create(manager(), {
          name: 'Nested',
          type: 'CATEGORY',
          parentId: 'category-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a category from another server', async () => {
      harness.rows.push(
        channel({ id: 'category-elsewhere', serverId: 'server-2', type: 'CATEGORY' }),
      );

      await expect(
        harness.channels.create(manager(), { name: 'sneaky', parentId: 'category-elsewhere' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('puts a new channel at the bottom of its category', async () => {
      const created = await harness.channels.create(manager(), {
        name: 'ideas',
        parentId: 'category-1',
      });

      expect(created.position).toBe(2);
    });
  });

  describe('update', () => {
    it('rejects an edit from a member without MANAGE_CHANNELS in that channel', async () => {
      harness.overrides.push({
        channelId: 'channel-staff',
        type: 'ROLE',
        roleId: MOD_ROLE,
        userId: null,
        allow: 0,
        deny: Permission.MANAGE_CHANNELS,
      });

      const mod = member({
        permissions: DEFAULT_EVERYONE_PERMISSIONS | Permission.MANAGE_CHANNELS,
        roleIds: [EVERYONE_ROLE, MOD_ROLE],
        highestPosition: 1,
      });

      await expect(
        harness.channels.update(mod, 'channel-staff', { name: 'renamed' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a channel id from another server as missing', async () => {
      harness.rows.push(channel({ id: 'channel-elsewhere', serverId: 'server-2' }));

      const owner = member({
        userId: 'owner-user',
        isOwner: true,
        permissions: ALL_PERMISSIONS,
        highestPosition: OWNER_POSITION,
      });

      await expect(
        harness.channels.update(owner, 'channel-elsewhere', { name: 'stolen' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses to make a channel its own category', async () => {
      const owner = member({
        userId: 'owner-user',
        isOwner: true,
        permissions: ALL_PERMISSIONS,
        highestPosition: OWNER_POSITION,
      });

      await expect(
        harness.channels.update(owner, 'channel-general', { parentId: 'channel-general' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('moves a channel to the top level when parentId is null', async () => {
      const owner = member({
        userId: 'owner-user',
        isOwner: true,
        permissions: ALL_PERMISSIONS,
        highestPosition: OWNER_POSITION,
      });

      const updated = await harness.channels.update(owner, 'channel-general', { parentId: null });

      expect(updated.parentId).toBeNull();
    });
  });

  describe('overrides', () => {
    const admin = () =>
      member({
        userId: 'admin-user',
        memberId: 'member-admin',
        permissions: ALL_PERMISSIONS,
        roleIds: [EVERYONE_ROLE, MOD_ROLE],
        highestPosition: 5,
      });

    /**
     * Room membership is the read boundary for realtime and it is resolved when a
     * socket connects, so an override written now only reaches an open connection if
     * the sockets are moved. Without it, a channel just hidden from someone keeps
     * delivering its messages to them until they reload.
     */
    it('recomputes the rooms of everybody holding the role that was overridden', async () => {
      const staff = member({ userId: 'user-mod', memberId: 'member-mod', roleIds: [MOD_ROLE] });
      const plain = member({ userId: 'user-plain', memberId: 'member-plain' });
      const local = buildHarness(
        [channel({ id: 'channel-staff', name: 'staff' })],
        [],
        [staff, plain],
      );

      await local.channels.setRoleOverride(admin(), 'channel-staff', MOD_ROLE, {
        allow: 0,
        deny: Permission.VIEW_CHANNEL,
      });

      // Nobody else's resolution can have changed, so nobody else is touched.
      expect(local.resynced).toEqual(['user-mod']);
    });

    it('recomputes the rooms of the one member an override names', async () => {
      const plain = member({ userId: 'user-plain', memberId: 'member-plain' });
      const local = buildHarness([channel({ id: 'channel-staff', name: 'staff' })], [], [plain]);

      await local.channels.setMemberOverride(admin(), 'channel-staff', 'user-plain', {
        allow: 0,
        deny: Permission.VIEW_CHANNEL,
      });

      expect(local.resynced).toEqual(['user-plain']);
    });

    /** Granting access is the same staleness the other way round. */
    it('recomputes the rooms when an override hands access back', async () => {
      const plain = member({ userId: 'user-plain', memberId: 'member-plain' });
      const local = buildHarness([channel({ id: 'channel-staff', name: 'staff' })], [], [plain]);

      await local.channels.setMemberOverride(admin(), 'channel-staff', 'user-plain', {
        allow: Permission.VIEW_CHANNEL,
        deny: 0,
      });

      expect(local.resynced).toEqual(['user-plain']);
    });

    it('stores an allow/deny pair for a role', async () => {
      const result = await harness.channels.setRoleOverride(admin(), 'channel-staff', MOD_ROLE, {
        allow: Permission.VIEW_CHANNEL,
        deny: Permission.SEND_MESSAGES,
      });

      expect(result).toEqual([
        {
          type: 'ROLE',
          roleId: MOD_ROLE,
          userId: null,
          allow: Permission.VIEW_CHANNEL,
          deny: Permission.SEND_MESSAGES,
        },
      ]);
    });

    it('deletes the override when everything goes back to neutral', async () => {
      harness.overrides.push({
        channelId: 'channel-staff',
        type: 'ROLE',
        roleId: MOD_ROLE,
        userId: null,
        allow: Permission.VIEW_CHANNEL,
        deny: 0,
      });

      const result = await harness.channels.setRoleOverride(admin(), 'channel-staff', MOD_ROLE, {
        allow: 0,
        deny: 0,
      });

      expect(result).toEqual([]);
    });

    it('rejects a flag that is both allowed and denied', async () => {
      await expect(
        harness.channels.setRoleOverride(admin(), 'channel-staff', MOD_ROLE, {
          allow: Permission.SEND_MESSAGES,
          deny: Permission.SEND_MESSAGES,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to grant a permission the caller does not hold here', async () => {
      const mod = member({
        permissions: DEFAULT_EVERYONE_PERMISSIONS | Permission.MANAGE_ROLES,
        roleIds: [EVERYONE_ROLE, MOD_ROLE],
        highestPosition: 1,
      });

      await expect(
        harness.channels.setRoleOverride(mod, 'channel-staff', EVERYONE_ROLE, {
          allow: Permission.ADMINISTRATOR,
          deny: 0,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses to edit an override for a role at or above the caller', async () => {
      const mod = member({
        permissions: DEFAULT_EVERYONE_PERMISSIONS | Permission.MANAGE_ROLES,
        roleIds: [EVERYONE_ROLE, MOD_ROLE],
        highestPosition: 1,
      });

      await expect(
        harness.channels.setRoleOverride(mod, 'channel-staff', MOD_ROLE, {
          allow: 0,
          deny: Permission.SEND_MESSAGES,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses a member override on someone the caller does not outrank', async () => {
      const peerMod = member({
        userId: 'user-peer',
        memberId: 'member-peer',
        permissions: DEFAULT_EVERYONE_PERMISSIONS | Permission.MANAGE_ROLES,
        roleIds: [EVERYONE_ROLE, MOD_ROLE],
        highestPosition: 1,
      });

      harness = buildHarness(harness.rows, harness.overrides, [member(), peerMod]);

      const actor = member({
        permissions: DEFAULT_EVERYONE_PERMISSIONS | Permission.MANAGE_ROLES,
        roleIds: [EVERYONE_ROLE, MOD_ROLE],
        highestPosition: 1,
      });

      await expect(
        harness.channels.setMemberOverride(actor, 'channel-staff', 'user-peer', {
          allow: 0,
          deny: Permission.SEND_MESSAGES,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an override for someone who is not a member', async () => {
      await expect(
        harness.channels.setMemberOverride(admin(), 'channel-staff', 'user-stranger', {
          allow: 0,
          deny: Permission.SEND_MESSAGES,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('hides the override list from a member without MANAGE_ROLES', async () => {
      await expect(harness.channels.overrides(member(), 'channel-staff')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('deletes a channel for a member who may manage it', async () => {
      const owner = member({
        userId: 'owner-user',
        isOwner: true,
        permissions: ALL_PERMISSIONS,
        highestPosition: OWNER_POSITION,
      });

      await harness.channels.remove(owner, 'channel-staff');

      expect(harness.deleted).toEqual(['channel-staff']);
      expect(harness.audited).toEqual([
        {
          serverId: SERVER,
          actorId: 'owner-user',
          action: 'CHANNEL_DELETE',
          targetId: 'channel-staff',
        },
      ]);
    });

    it('rejects a delete from a member with no MANAGE_CHANNELS at all', async () => {
      await expect(
        harness.channels.remove(member({ highestPosition: NO_ROLE_POSITION }), 'channel-staff'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('voiceStates', () => {
    // The member the harness seeds, so re-resolving their permissions finds them.
    const ADA = 'user-1';

    /** Puts someone in a voice channel of the seeded server. */
    function seedCall(channelId: string, userId = ADA) {
      harness.rows.push(channel({ id: channelId, name: channelId, type: 'VOICE' }));
      harness.voice.join({
        serverId: SERVER,
        channelId,
        socketId: `socket-${userId}`,
        user: {
          id: userId,
          username: userId,
          displayName: null,
          avatarUrl: null,
          accentColor: null,
          status: 'ONLINE',
        },
        canSpeak: true,
      });
    }

    it('reports who is in a voice channel the member can see', async () => {
      seedCall('channel-voice');

      const states = await harness.channels.voiceStates(member());

      expect(states.map((state) => state.user.id)).toEqual([ADA]);
    });

    it('says nothing about a call in a channel the member cannot see', async () => {
      seedCall('channel-secret-voice');
      harness.overrides.push({
        channelId: 'channel-secret-voice',
        type: 'ROLE',
        roleId: EVERYONE_ROLE,
        userId: null,
        allow: 0,
        deny: Permission.VIEW_CHANNEL,
      });

      const states = await harness.channels.voiceStates(member());

      expect(states).toEqual([]);
    });

    it('leaves text channels out of it', async () => {
      const states = await harness.channels.voiceStates(member());

      expect(states).toEqual([]);
    });

    it('drops a member out of a call once an override takes CONNECT away', async () => {
      seedCall('channel-voice');

      await harness.channels.setRoleOverride(
        member({ permissions: ALL_PERMISSIONS, isOwner: true, highestPosition: OWNER_POSITION }),
        'channel-voice',
        EVERYONE_ROLE,
        { allow: 0, deny: Permission.CONNECT },
      );

      expect(harness.evicted).toEqual([{ channelId: 'channel-voice', userId: ADA }]);
      expect(harness.voice.isIn('channel-voice', ADA)).toBe(false);
    });

    it('leaves a call alone when an override does not touch CONNECT', async () => {
      seedCall('channel-voice');

      await harness.channels.setRoleOverride(
        member({ permissions: ALL_PERMISSIONS, isOwner: true, highestPosition: OWNER_POSITION }),
        'channel-voice',
        EVERYONE_ROLE,
        { allow: 0, deny: Permission.SEND_MESSAGES },
      );

      expect(harness.evicted).toEqual([]);
      expect(harness.voice.isIn('channel-voice', ADA)).toBe(true);
    });

    it('empties a call when the channel is deleted', async () => {
      seedCall('channel-voice');

      await harness.channels.remove(
        member({ permissions: ALL_PERMISSIONS, isOwner: true, highestPosition: OWNER_POSITION }),
        'channel-voice',
      );

      expect(harness.evicted).toEqual([{ channelId: 'channel-voice', userId: ADA }]);
    });
  });
});
