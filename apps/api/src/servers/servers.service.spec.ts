import { describe, expect, it } from 'vitest';

import {
  ALL_PERMISSIONS,
  DEFAULT_CHANNEL_NAME,
  DEFAULT_EVERYONE_PERMISSIONS,
  DEFAULT_ROLE_NAME,
} from '@nestcord/shared';

import {
  NO_ROLE_POSITION,
  OWNER_POSITION,
  type MemberContext,
} from '../common/permissions/member-context';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { RealtimeService } from '../gateway/realtime.service';
import type { ServerIconStorage } from './server-icon.storage';
import { ServersService } from './servers.service';

const SERVER = 'server-1';

function member(overrides: Partial<MemberContext> = {}): MemberContext {
  return {
    serverId: SERVER,
    memberId: 'member-1',
    userId: 'user-1',
    isOwner: false,
    permissions: DEFAULT_EVERYONE_PERMISSIONS,
    roleIds: ['everyone'],
    highestPosition: NO_ROLE_POSITION,
    ...overrides,
  };
}

interface Harness {
  servers: ServersService;
  broadcasts: Array<{ event: string; payload: unknown }>;
  rolesCreated: Record<string, unknown>[];
  channelsCreated: Record<string, unknown>[];
  membersCreated: Record<string, unknown>[];
  membersDeleted: string[];
  serversDeleted: string[];
  iconsRemoved: (string | null)[];
}

function buildHarness(): Harness {
  const rolesCreated: Record<string, unknown>[] = [];
  const channelsCreated: Record<string, unknown>[] = [];
  const membersCreated: Record<string, unknown>[] = [];
  const membersDeleted: string[] = [];
  const serversDeleted: string[] = [];
  const iconsRemoved: (string | null)[] = [];

  const transactionClient = {
    server: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: SERVER, ...data }),
    },
    role: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        rolesCreated.push(data);
        return { id: 'everyone' };
      },
    },
    serverMember: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        membersCreated.push(data);
        return { id: 'member-owner' };
      },
    },
    memberRole: { create: async () => ({}) },
    channel: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        channelsCreated.push(data);
        return { id: 'channel-1' };
      },
    },
  };

  const prisma = {
    client: {
      $transaction: async <T>(callback: (tx: typeof transactionClient) => Promise<T>) =>
        callback(transactionClient),
      server: {
        findUnique: async () => ({
          id: SERVER,
          name: 'NestCord HQ',
          iconUrl: null,
          ownerId: 'owner',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          roles: [],
          _count: { members: 1 },
        }),
        findMany: async () => [],
        update: async () => ({}),
        delete: async ({ where }: { where: { id: string } }) => {
          serversDeleted.push(where.id);
          return {};
        },
      },
      serverMember: {
        delete: async ({ where }: { where: { id: string } }) => {
          membersDeleted.push(where.id);
          return {};
        },
      },
    },
  } as unknown as PrismaService;

  const icons = {
    save: async () => '/uploads/icons/x.png',
    remove: async (url: string | null) => {
      iconsRemoved.push(url);
    },
  } as unknown as ServerIconStorage;

  // Broadcasts are recorded so a test can assert what the server told everyone.
  const broadcasts: Array<{ event: string; payload: unknown }> = [];
  const realtime = {
    memberLeft: (payload: unknown) => broadcasts.push({ event: 'member:leave', payload }),
  } as unknown as RealtimeService;

  return {
    servers: new ServersService(prisma, icons, realtime),
    broadcasts,
    rolesCreated,
    channelsCreated,
    membersCreated,
    membersDeleted,
    serversDeleted,
    iconsRemoved,
  };
}

describe('ServersService', () => {
  describe('create', () => {
    it('creates an @everyone role with the default permissions', async () => {
      const { servers, rolesCreated } = buildHarness();

      await servers.create('owner', 'NestCord HQ');

      expect(rolesCreated[0]).toMatchObject({
        name: DEFAULT_ROLE_NAME,
        permissions: DEFAULT_EVERYONE_PERMISSIONS,
        position: 0,
        isDefault: true,
      });
    });

    it('joins the creator to their own server', async () => {
      const { servers, membersCreated } = buildHarness();

      await servers.create('owner', 'NestCord HQ');

      expect(membersCreated[0]).toMatchObject({ serverId: SERVER, userId: 'owner' });
    });

    /** A server with no channels would leave the app with nothing to open. */
    it('creates a default text channel so the server is not empty', async () => {
      const { servers, channelsCreated } = buildHarness();

      await servers.create('owner', 'NestCord HQ');

      expect(channelsCreated[0]).toMatchObject({ name: DEFAULT_CHANNEL_NAME, type: 'TEXT' });
    });

    it('reports the creator as holding every permission', async () => {
      const { servers } = buildHarness();

      const server = await servers.create('owner', 'NestCord HQ');

      expect(server.permissions).toBe(ALL_PERMISSIONS);
    });
  });

  describe('leave', () => {
    /**
     * A server whose owner walked out has nobody who can administer it, so the owner
     * is pushed towards deleting it instead.
     */
    it('refuses to let the owner leave', async () => {
      const { servers, membersDeleted } = buildHarness();
      const owner = member({ isOwner: true, highestPosition: OWNER_POSITION });

      await expect(servers.leave(owner)).rejects.toMatchObject({ status: 400 });
      expect(membersDeleted).toEqual([]);
    });

    it('lets an ordinary member leave', async () => {
      const { servers, membersDeleted } = buildHarness();

      await servers.leave(member({ memberId: 'member-9' }));

      expect(membersDeleted).toEqual(['member-9']);
    });
  });

  describe('remove', () => {
    /** MANAGE_SERVER lets a moderator rename a server, not destroy it. */
    it('refuses a non-owner even with every permission', async () => {
      const { servers, serversDeleted } = buildHarness();
      const admin = member({ permissions: ALL_PERMISSIONS, highestPosition: 5 });

      await expect(servers.remove(admin)).rejects.toMatchObject({ status: 403 });
      expect(serversDeleted).toEqual([]);
    });

    it('lets the owner delete the server', async () => {
      const { servers, serversDeleted } = buildHarness();
      const owner = member({ isOwner: true, highestPosition: OWNER_POSITION });

      await servers.remove(owner);

      expect(serversDeleted).toEqual([SERVER]);
    });
  });
});
