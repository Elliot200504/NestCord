import { describe, expect, it } from 'vitest';

import { DEFAULT_EVERYONE_PERMISSIONS, INVITE_CODE_PATTERN } from '@nestcord/shared';

import { NO_ROLE_POSITION, type MemberContext } from '../common/permissions/member-context';
import type { PermissionsService } from '../common/permissions/permissions.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import { InvitesService } from './invites.service';
import type { ServersService } from './servers.service';

const SERVER = 'server-1';

interface StubInvite {
  code: string;
  serverId: string;
  uses: number;
  maxUses: number | null;
  expiresAt: Date | null;
  createdAt: Date;
}

function invite(overrides: Partial<StubInvite> = {}): StubInvite {
  return {
    code: 'Kp3rTx9a',
    serverId: SERVER,
    uses: 0,
    maxUses: null,
    expiresAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
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
    roleIds: ['everyone'],
    highestPosition: NO_ROLE_POSITION,
    ...overrides,
  };
}

interface HarnessOptions {
  invites: StubInvite[];
  /** Users already in the server. */
  members?: MemberContext[];
  bannedUserIds?: string[];
  hasDefaultRole?: boolean;
}

interface Harness {
  invites: InvitesService;
  joined: { serverId: string; userId: string }[];
  incremented: string[];
  createdCodes: string[];
  deleted: { code: string; serverId: string }[];
}

function buildHarness(options: HarnessOptions): Harness {
  const { invites: inviteRows, members = [], bannedUserIds = [], hasDefaultRole = true } = options;

  const joined: { serverId: string; userId: string }[] = [];
  const incremented: string[] = [];
  const createdCodes: string[] = [];
  const deleted: { code: string; serverId: string }[] = [];

  const transactionClient = {
    serverMember: {
      create: async ({ data }: { data: { serverId: string; userId: string } }) => {
        joined.push(data);
        return { id: `member-${data.userId}` };
      },
    },
    memberRole: { create: async () => ({}) },
    invite: {
      update: async ({ where }: { where: { code: string } }) => {
        incremented.push(where.code);
        return invite();
      },
    },
  };

  const prisma = {
    client: {
      invite: {
        findUnique: async ({
          where,
          select,
        }: {
          where: { code: string };
          select?: Record<string, unknown>;
        }) => {
          const found = inviteRows.find((entry) => entry.code === where.code);
          if (!found) return null;

          // The uniqueness probe in `create` only selects the code.
          if (select && 'code' in select && Object.keys(select).length === 1) {
            return { code: found.code };
          }

          return {
            ...found,
            server: {
              id: found.serverId,
              name: 'NestCord HQ',
              iconUrl: null,
              ownerId: 'owner',
              _count: { members: 7 },
            },
          };
        },
        findMany: async () => inviteRows,
        create: async ({ data }: { data: { code: string } }) => {
          createdCodes.push(data.code);
          return invite({ ...data });
        },
        deleteMany: async ({ where }: { where: { code: string; serverId: string } }) => {
          const match = inviteRows.find(
            (entry) => entry.code === where.code && entry.serverId === where.serverId,
          );

          if (!match) return { count: 0 };

          deleted.push(where);
          return { count: 1 };
        },
      },
      ban: {
        findUnique: async ({
          where,
        }: {
          where: { serverId_userId: { serverId: string; userId: string } };
        }) =>
          bannedUserIds.includes(where.serverId_userId.userId)
            ? { serverId: where.serverId_userId.serverId }
            : null,
      },
      role: {
        findFirst: async () => (hasDefaultRole ? { id: 'everyone' } : null),
      },
      $transaction: async <T>(callback: (tx: typeof transactionClient) => Promise<T>) =>
        callback(transactionClient),
    },
  } as unknown as PrismaService;

  const permissions = {
    findMemberContext: async (serverId: string, userId: string) =>
      members.find((entry) => entry.serverId === serverId && entry.userId === userId) ?? null,
    requireMembership: async (serverId: string, userId: string) =>
      member({ serverId, userId, memberId: `member-${userId}` }),
  } as unknown as PermissionsService;

  const servers = {
    findOne: async (serverId: string, resolved: number) => ({
      id: serverId,
      name: 'NestCord HQ',
      iconUrl: null,
      ownerId: 'owner',
      createdAt: new Date().toISOString(),
      memberCount: 7,
      roles: [],
      permissions: resolved,
    }),
  } as unknown as ServersService;

  return {
    invites: new InvitesService(prisma, permissions, servers),
    joined,
    incremented,
    createdCodes,
    deleted,
  };
}

describe('InvitesService', () => {
  describe('code generation', () => {
    it('produces codes that match the shared pattern', async () => {
      const { invites, createdCodes } = buildHarness({ invites: [] });

      await invites.create(member(), {});

      expect(createdCodes[0]).toMatch(INVITE_CODE_PATTERN);
    });

    it('stores an expiry when one was asked for, and none when it was not', async () => {
      const { invites } = buildHarness({ invites: [] });

      const withExpiry = await invites.create(member(), { expiresInHours: 1 });
      const withoutExpiry = await invites.create(member(), {});

      expect(withExpiry.expiresAt).not.toBeNull();
      expect(withoutExpiry.expiresAt).toBeNull();
    });
  });

  describe('validity', () => {
    it('rejects a code that does not exist', async () => {
      const { invites } = buildHarness({ invites: [] });

      await expect(invites.preview('Kp3rTx9a')).rejects.toMatchObject({ status: 404 });
    });

    it('rejects an expired invite', async () => {
      const expired = invite({ expiresAt: new Date(Date.now() - 1000) });
      const { invites } = buildHarness({ invites: [expired] });

      await expect(invites.preview(expired.code)).rejects.toMatchObject({ status: 404 });
    });

    it('accepts an invite whose expiry is still ahead', async () => {
      const live = invite({ expiresAt: new Date(Date.now() + 60_000) });
      const { invites } = buildHarness({ invites: [live] });

      await expect(invites.preview(live.code)).resolves.toMatchObject({ code: live.code });
    });

    it('rejects an invite that has hit its use limit', async () => {
      const spent = invite({ uses: 3, maxUses: 3 });
      const { invites } = buildHarness({ invites: [spent] });

      await expect(invites.preview(spent.code)).rejects.toMatchObject({ status: 404 });
    });

    it('accepts an invite with uses left', async () => {
      const fresh = invite({ uses: 2, maxUses: 3 });
      const { invites } = buildHarness({ invites: [fresh] });

      await expect(invites.preview(fresh.code)).resolves.toMatchObject({ memberCount: 7 });
    });

    /**
     * Expired, used up and never-existed all answer the same way, so a stranger
     * probing codes learns nothing from the difference.
     */
    it('gives the same message whatever made the invite unusable', async () => {
      const missing = buildHarness({ invites: [] });
      const expired = buildHarness({ invites: [invite({ expiresAt: new Date(0) })] });

      const first = await missing.invites
        .preview('Kp3rTx9a')
        .catch((error: Error) => error.message);
      const second = await expired.invites
        .preview('Kp3rTx9a')
        .catch((error: Error) => error.message);

      expect(first).toBe(second);
    });
  });

  describe('joining', () => {
    it('adds the user and spends a use', async () => {
      const usable = invite();
      const { invites, joined, incremented } = buildHarness({ invites: [usable] });

      await invites.join('newcomer', usable.code);

      expect(joined).toEqual([{ serverId: SERVER, userId: 'newcomer' }]);
      expect(incremented).toEqual([usable.code]);
    });

    it('is idempotent for someone already in the server, and spends no use', async () => {
      const usable = invite();
      const existing = member({ userId: 'insider' });
      const { invites, joined, incremented } = buildHarness({
        invites: [usable],
        members: [existing],
      });

      const server = await invites.join('insider', usable.code);

      expect(server.id).toBe(SERVER);
      expect(joined).toEqual([]);
      expect(incremented).toEqual([]);
    });

    /**
     * The case that matters for a one-use link: the person who just spent it must
     * still be able to follow it, or a refresh of the page locks them out of the
     * server they are already in.
     */
    it('is still idempotent once the invite has been used up', async () => {
      const spent = invite({ uses: 1, maxUses: 1 });
      const existing = member({ userId: 'insider' });
      const { invites, joined, incremented } = buildHarness({
        invites: [spent],
        members: [existing],
      });

      const server = await invites.join('insider', spent.code);

      expect(server.id).toBe(SERVER);
      expect(joined).toEqual([]);
      expect(incremented).toEqual([]);
    });

    it('still refuses a used-up invite to somebody who is not a member', async () => {
      const spent = invite({ uses: 1, maxUses: 1 });
      const { invites, joined } = buildHarness({ invites: [spent] });

      await expect(invites.join('outsider', spent.code)).rejects.toMatchObject({ status: 404 });
      expect(joined).toEqual([]);
    });

    it('refuses a banned user', async () => {
      const usable = invite();
      const { invites, joined } = buildHarness({
        invites: [usable],
        bannedUserIds: ['outcast'],
      });

      await expect(invites.join('outcast', usable.code)).rejects.toMatchObject({ status: 403 });
      expect(joined).toEqual([]);
    });

    it('does not join through an expired invite', async () => {
      const expired = invite({ expiresAt: new Date(Date.now() - 1) });
      const { invites, joined } = buildHarness({ invites: [expired] });

      await expect(invites.join('newcomer', expired.code)).rejects.toMatchObject({ status: 404 });
      expect(joined).toEqual([]);
    });

    it('fails rather than joining a server with no default role', async () => {
      const usable = invite();
      const { invites, joined } = buildHarness({ invites: [usable], hasDefaultRole: false });

      await expect(invites.join('newcomer', usable.code)).rejects.toMatchObject({ status: 404 });
      expect(joined).toEqual([]);
    });
  });

  describe('revoking', () => {
    it('deletes an invite belonging to the actor’s server', async () => {
      const usable = invite();
      const { invites, deleted } = buildHarness({ invites: [usable] });

      await invites.revoke(member(), usable.code);

      expect(deleted).toEqual([{ code: usable.code, serverId: SERVER }]);
    });

    /** Knowing a code must not be enough to delete it from someone else's server. */
    it('will not delete an invite that belongs to another server', async () => {
      const foreign = invite({ serverId: 'server-2' });
      const { invites, deleted } = buildHarness({ invites: [foreign] });

      await expect(invites.revoke(member(), foreign.code)).rejects.toMatchObject({ status: 404 });
      expect(deleted).toEqual([]);
    });
  });
});
