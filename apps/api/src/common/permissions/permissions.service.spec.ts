import { beforeEach, describe, expect, it } from 'vitest';

import { ALL_PERMISSIONS, DEFAULT_EVERYONE_PERMISSIONS, Permission } from '@nestcord/shared';

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

/**
 * Stands in for the one query this service makes. It is the permission *rules* under
 * test here, not the query — see the note in `common/testing/fake-prisma.ts`.
 */
function buildService(members: StubMember[]): PermissionsService {
  const prisma = {
    client: {
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
            id: found.id,
            userId: found.userId,
            serverId: found.serverId,
            server: { ownerId: found.ownerId },
            roles: found.roles.map((role) => ({ role })),
          };
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
