import { beforeEach, describe, expect, it } from 'vitest';

import { ALL_PERMISSIONS, DEFAULT_EVERYONE_PERMISSIONS, Permission } from '@nestcord/shared';

import type { OverrideRow } from './channel-overrides';
import type { PrismaService } from '../prisma/prisma.service';
import { NO_ROLE_POSITION, OWNER_POSITION } from './member-context';
import { PermissionsService } from './permissions.service';

interface StubRole {
  id: string;
  permissions: number;
  position: number;
}

interface StubMember {
  id: string;
  userId: string;
  serverId: string;
  ownerId: string;
  roles: StubRole[];
}

interface StubChannel {
  id: string;
  serverId: string;
  ownerId: string;
  overrides: OverrideRow[];
}

/**
 * Stands in for the queries this service makes. It is the permission *rules* under
 * test here, not the queries — see the note in `common/testing/fake-prisma.ts`.
 */
function buildService(members: StubMember[], channels: StubChannel[] = []): PermissionsService {
  const row = (found: StubMember) => ({
    id: found.id,
    userId: found.userId,
    serverId: found.serverId,
    server: { ownerId: found.ownerId },
    roles: found.roles.map((role) => ({ role })),
  });

  const prisma = {
    client: {
      channel: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const found = channels.find((entry) => entry.id === where.id);

          if (!found) return null;

          // `server` is redundant now the owner id is read off each member row,
          // but keeping it means these tests also pass against the previous
          // implementation, which read it from the channel.
          return {
            serverId: found.serverId,
            server: { ownerId: found.ownerId },
            overrides: found.overrides,
          };
        },
      },
      serverMember: {
        findMany: async ({ where }: { where: { serverId: string } }) =>
          members.filter((entry) => entry.serverId === where.serverId).map(row),
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

          return row(found);
        },
      },
    },
  } as unknown as PrismaService;

  return new PermissionsService(prisma);
}

const EVERYONE: StubRole = {
  id: 'everyone',
  permissions: DEFAULT_EVERYONE_PERMISSIONS,
  position: 0,
};

describe('PermissionsService', () => {
  let members: StubMember[];

  beforeEach(() => {
    members = [
      {
        id: 'member-plain',
        userId: 'plain',
        serverId: 'server-1',
        ownerId: 'owner',
        roles: [EVERYONE],
      },
      {
        id: 'member-owner',
        userId: 'owner',
        serverId: 'server-1',
        ownerId: 'owner',
        roles: [EVERYONE],
      },
      {
        id: 'member-mod',
        userId: 'mod',
        serverId: 'server-1',
        ownerId: 'owner',
        roles: [
          EVERYONE,
          { id: 'mod-role', permissions: Permission.KICK_MEMBERS, position: 3 },
          { id: 'helper', permissions: Permission.MANAGE_MESSAGES, position: 1 },
        ],
      },
      {
        id: 'member-admin',
        userId: 'admin',
        serverId: 'server-1',
        ownerId: 'owner',
        roles: [EVERYONE, { id: 'admin-role', permissions: Permission.ADMINISTRATOR, position: 2 }],
      },
    ];
  });

  describe('findChannelViewers', () => {
    const everyoneDeny = (deny: number): OverrideRow => ({
      type: 'ROLE',
      roleId: 'everyone',
      userId: null,
      allow: 0,
      deny,
      role: { isDefault: true },
    });

    it('lists every member who can see an unrestricted channel', async () => {
      const service = buildService(members, [
        { id: 'channel-1', serverId: 'server-1', ownerId: 'owner', overrides: [] },
      ]);

      const viewers = await service.findChannelViewers('channel-1');

      expect([...viewers].sort()).toEqual(['admin', 'mod', 'owner', 'plain']);
    });

    it('leaves out a member whose @everyone override removes VIEW_CHANNEL', async () => {
      const service = buildService(members, [
        {
          id: 'channel-1',
          serverId: 'server-1',
          ownerId: 'owner',
          overrides: [everyoneDeny(Permission.VIEW_CHANNEL)],
        },
      ]);

      const viewers = await service.findChannelViewers('channel-1');

      // The owner and the administrator are unaffected: both bypass overrides.
      expect([...viewers].sort()).toEqual(['admin', 'owner']);
    });

    it('still counts the owner when the row is read per member rather than per channel', async () => {
      const service = buildService(members, [
        {
          id: 'channel-1',
          serverId: 'server-1',
          ownerId: 'owner',
          overrides: [everyoneDeny(Permission.VIEW_CHANNEL)],
        },
      ]);

      const viewers = await service.findChannelViewers('channel-1');

      expect(viewers).toContain('owner');
    });

    it('returns nobody for a channel that does not exist', async () => {
      const service = buildService(members, []);

      await expect(service.findChannelViewers('ghost')).resolves.toEqual([]);
    });

    it('ignores members of other servers', async () => {
      const service = buildService(
        [
          ...members,
          {
            id: 'member-elsewhere',
            userId: 'elsewhere',
            serverId: 'server-2',
            ownerId: 'other-owner',
            roles: [EVERYONE],
          },
        ],
        [{ id: 'channel-1', serverId: 'server-1', ownerId: 'owner', overrides: [] }],
      );

      const viewers = await service.findChannelViewers('channel-1');

      expect(viewers).not.toContain('elsewhere');
    });
  });

  it('returns null for someone who is not a member', async () => {
    const service = buildService(members);

    await expect(service.findMemberContext('server-1', 'stranger')).resolves.toBeNull();
  });

  it('unions the permissions of every role a member holds', async () => {
    const service = buildService(members);

    const context = await service.findMemberContext('server-1', 'mod');

    expect(context?.permissions).toBe(
      DEFAULT_EVERYONE_PERMISSIONS | Permission.KICK_MEMBERS | Permission.MANAGE_MESSAGES,
    );
  });

  it('takes the highest position from the roles held, not the first', async () => {
    const service = buildService(members);

    const context = await service.findMemberContext('server-1', 'mod');

    expect(context?.highestPosition).toBe(3);
  });

  it('gives the owner every permission and the top position', async () => {
    const service = buildService(members);

    const context = await service.findMemberContext('server-1', 'owner');

    expect(context?.isOwner).toBe(true);
    expect(context?.permissions).toBe(ALL_PERMISSIONS);
    expect(context?.highestPosition).toBe(OWNER_POSITION);
  });

  it('expands ADMINISTRATOR into every permission', async () => {
    const service = buildService(members);

    const context = await service.findMemberContext('server-1', 'admin');

    expect(context?.permissions).toBe(ALL_PERMISSIONS);
  });

  it('does not treat an administrator as the owner', async () => {
    const service = buildService(members);

    const context = await service.findMemberContext('server-1', 'admin');

    expect(context?.isOwner).toBe(false);
    expect(context?.highestPosition).toBe(2);
  });

  it('leaves a roleless member at the floor position', async () => {
    const service = buildService([
      { id: 'm', userId: 'lonely', serverId: 'server-1', ownerId: 'owner', roles: [] },
    ]);

    const context = await service.findMemberContext('server-1', 'lonely');

    expect(context?.highestPosition).toBe(NO_ROLE_POSITION);
    expect(context?.permissions).toBe(0);
  });

  /**
   * 404, not 403: a non-member must not be able to tell a server that exists from
   * one that never did.
   */
  it('reports a non-member as not found rather than forbidden', async () => {
    const service = buildService(members);

    await expect(service.requireMembership('server-1', 'stranger')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('rejects a member who lacks the flag with a 403', async () => {
    const service = buildService(members);

    await expect(
      service.requirePermission('server-1', 'plain', Permission.MANAGE_SERVER),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows a member who holds the flag', async () => {
    const service = buildService(members);

    const context = await service.requirePermission('server-1', 'mod', Permission.KICK_MEMBERS);

    expect(context.userId).toBe('mod');
  });

  it('lets an administrator through a check for a flag not explicitly granted', async () => {
    const service = buildService(members);

    const context = await service.requirePermission('server-1', 'admin', Permission.BAN_MEMBERS);

    expect(context.userId).toBe('admin');
  });

  it('refuses a non-owner on an owner-only action', async () => {
    const service = buildService(members);

    await expect(service.requireOwner('server-1', 'admin')).rejects.toMatchObject({ status: 403 });
  });
});
