import { beforeEach, describe, expect, it } from 'vitest';

import {
  ALL_PERMISSIONS,
  DEFAULT_EVERYONE_PERMISSIONS,
  DEFAULT_ROLE_NAME,
  Permission,
} from '@nestcord/shared';

import {
  NO_ROLE_POSITION,
  OWNER_POSITION,
  type MemberContext,
} from '../common/permissions/member-context';
import type { AuditLogService, AuditRecord } from '../common/audit/audit-log.service';
import type { PermissionsService } from '../common/permissions/permissions.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import { RolesService } from './roles.service';

interface StubRole {
  id: string;
  serverId: string;
  name: string;
  color: string | null;
  permissions: number;
  position: number;
  isDefault: boolean;
}

const SERVER = 'server-1';

function role(overrides: Partial<StubRole> = {}): StubRole {
  return {
    id: 'role-1',
    serverId: SERVER,
    name: 'Helper',
    color: null,
    permissions: 0,
    position: 1,
    isDefault: false,
    ...overrides,
  };
}

function member(overrides: Partial<MemberContext> = {}): MemberContext {
  return {
    serverId: SERVER,
    memberId: 'member-1',
    userId: 'user-1',
    isOwner: false,
    permissions: 0,
    roleIds: [],
    highestPosition: NO_ROLE_POSITION,
    ...overrides,
  };
}

interface Harness {
  roles: RolesService;
  created: Record<string, unknown>[];
  updated: Record<string, unknown>[];
  deleted: string[];
  assigned: { memberId: string; roleId: string }[];
  unassigned: { memberId: string; roleId: string }[];
  audited: AuditRecord[];
}

/** Records writes instead of performing them: the rules are what is under test. */
function buildHarness(roleRows: StubRole[], members: MemberContext[]): Harness {
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const deleted: string[] = [];
  const assigned: { memberId: string; roleId: string }[] = [];
  const unassigned: { memberId: string; roleId: string }[] = [];

  const prisma = {
    client: {
      role: {
        findMany: async () => roleRows,
        findFirst: async ({ where }: { where: { id: string; serverId: string } }) =>
          roleRows.find((entry) => entry.id === where.id && entry.serverId === where.serverId) ??
          null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return role({ ...(data as Partial<StubRole>), id: 'new-role' });
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          updated.push({ id: where.id, ...data });
          const existing = roleRows.find((entry) => entry.id === where.id);
          return { ...role(existing), ...(data as Partial<StubRole>) };
        },
        delete: async ({ where }: { where: { id: string } }) => {
          deleted.push(where.id);
          return role();
        },
      },
      memberRole: {
        upsert: async ({ create }: { create: { memberId: string; roleId: string } }) => {
          assigned.push(create);
          return create;
        },
        deleteMany: async ({ where }: { where: { memberId: string; roleId: string } }) => {
          unassigned.push(where);
          return { count: 1 };
        },
      },
    },
  } as unknown as PrismaService;

  const permissions = {
    findMemberContext: async (serverId: string, userId: string) =>
      members.find((entry) => entry.serverId === serverId && entry.userId === userId) ?? null,
  } as unknown as PermissionsService;

  const audited: AuditRecord[] = [];
  const audit = {
    record: async (entry: AuditRecord) => {
      audited.push(entry);
    },
  } as unknown as AuditLogService;

  return {
    roles: new RolesService(prisma, permissions, audit),
    created,
    updated,
    deleted,
    assigned,
    unassigned,
    audited,
  };
}

describe('RolesService', () => {
  let everyone: StubRole;
  let helper: StubRole;
  let senior: StubRole;

  beforeEach(() => {
    everyone = role({
      id: 'everyone',
      name: DEFAULT_ROLE_NAME,
      permissions: DEFAULT_EVERYONE_PERMISSIONS,
      position: 0,
      isDefault: true,
    });
    helper = role({ id: 'helper', name: 'Helper', position: 1 });
    senior = role({ id: 'senior', name: 'Senior', position: 8 });
  });

  describe('privilege escalation', () => {
    /**
     * The single most important rule here: MANAGE_ROLES must not be a path to
     * ADMINISTRATOR, or one moderator can quietly take the whole server.
     */
    it('refuses to grant a permission the actor does not hold', async () => {
      const actor = member({ permissions: Permission.MANAGE_ROLES, highestPosition: 5 });
      const { roles } = buildHarness([everyone, helper], [actor]);

      await expect(
        roles.create(actor, { name: 'Sneaky', permissions: Permission.ADMINISTRATOR }),
      ).rejects.toMatchObject({ status: 403 });
    });

    /**
     * The escalation guard must be what stops this, not an incidental hierarchy
     * error — so the actor is given room above the new role's position first.
     */
    it('refuses the escalation on its own terms when hierarchy is not in the way', async () => {
      const actor = member({ permissions: Permission.MANAGE_ROLES, highestPosition: 6 });
      const { roles, created } = buildHarness([everyone, helper], [actor]);

      await expect(
        roles.create(actor, { name: 'Sneaky', permissions: Permission.ADMINISTRATOR }),
      ).rejects.toThrow(/permission you do not have/);
      expect(created).toEqual([]);
    });

    it('refuses to add an unheld permission on an edit either', async () => {
      const actor = member({ permissions: Permission.MANAGE_ROLES, highestPosition: 5 });
      const { roles } = buildHarness([everyone, helper], [actor]);

      await expect(
        roles.update(actor, helper.id, { permissions: Permission.BAN_MEMBERS }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('allows granting a permission the actor does hold', async () => {
      const actor = member({
        permissions: Permission.MANAGE_ROLES | Permission.KICK_MEMBERS,
        highestPosition: 5,
      });
      const { roles, created } = buildHarness([everyone], [actor]);

      await roles.create(actor, { name: 'Bouncer', permissions: Permission.KICK_MEMBERS });

      expect(created[0]).toMatchObject({ permissions: Permission.KICK_MEMBERS });
    });

    it('lets an administrator grant anything, since it holds everything', async () => {
      const actor = member({ permissions: ALL_PERMISSIONS, highestPosition: 5 });
      const { roles, created } = buildHarness([everyone], [actor]);

      await roles.create(actor, { name: 'Deputy', permissions: Permission.ADMINISTRATOR });

      expect(created[0]).toMatchObject({ permissions: Permission.ADMINISTRATOR });
    });

    /**
     * A bit we do not recognise must not be stored: nothing in the UI could later
     * see it to turn it off.
     */
    it('masks off bits that are not real permission flags', async () => {
      const actor = member({ permissions: ALL_PERMISSIONS, highestPosition: 5 });
      const { roles, created } = buildHarness([everyone], [actor]);

      await roles.create(actor, {
        name: 'Odd',
        permissions: Permission.SEND_MESSAGES | (1 << 30),
      });

      expect(created[0]).toMatchObject({ permissions: Permission.SEND_MESSAGES });
    });
  });

  describe('hierarchy', () => {
    /** No room below your own role means no role to create; the message says so. */
    it('refuses creation when the actor’s top role is already at the floor', async () => {
      const actor = member({ permissions: Permission.MANAGE_ROLES, highestPosition: 1 });
      const { roles, created } = buildHarness([everyone, helper], [actor]);

      await expect(roles.create(actor, { name: 'Nope' })).rejects.toThrow(
        /highest role is too low/,
      );
      expect(created).toEqual([]);
    });

    it('allows creation when the actor has room below their top role', async () => {
      const actor = member({ permissions: Permission.MANAGE_ROLES, highestPosition: 4 });
      const { roles, created } = buildHarness([everyone, helper], [actor]);

      await roles.create(actor, { name: 'Greeter' });

      expect(created[0]).toMatchObject({ name: 'Greeter', position: 1 });
    });

    it('refuses to edit a role at or above the actor’s highest', async () => {
      const actor = member({ permissions: ALL_PERMISSIONS, highestPosition: 8 });
      const { roles } = buildHarness([everyone, senior], [actor]);

      await expect(roles.update(actor, senior.id, { name: 'Renamed' })).rejects.toMatchObject({
        status: 403,
      });
    });

    it('refuses to move a role up to or past the actor’s own position', async () => {
      const actor = member({ permissions: ALL_PERMISSIONS, highestPosition: 5 });
      const { roles } = buildHarness([everyone, helper], [actor]);

      await expect(roles.update(actor, helper.id, { position: 5 })).rejects.toMatchObject({
        status: 403,
      });
    });

    it('allows editing a role below the actor', async () => {
      const actor = member({ permissions: ALL_PERMISSIONS, highestPosition: 5 });
      const { roles, updated } = buildHarness([everyone, helper], [actor]);

      await roles.update(actor, helper.id, { name: 'Greeter' });

      expect(updated[0]).toMatchObject({ id: helper.id, name: 'Greeter' });
    });

    it('lets the owner edit any role', async () => {
      const owner = member({
        userId: 'owner',
        isOwner: true,
        permissions: ALL_PERMISSIONS,
        highestPosition: OWNER_POSITION,
      });
      const { roles, updated } = buildHarness([everyone, senior], [owner]);

      await roles.update(owner, senior.id, { name: 'Elder' });

      expect(updated[0]).toMatchObject({ name: 'Elder' });
    });

    it('refuses to delete a role at or above the actor', async () => {
      const actor = member({ permissions: ALL_PERMISSIONS, highestPosition: 8 });
      const { roles } = buildHarness([everyone, senior], [actor]);

      await expect(roles.remove(actor, senior.id)).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('the default role', () => {
    it('refuses to delete @everyone', async () => {
      const owner = member({
        isOwner: true,
        permissions: ALL_PERMISSIONS,
        highestPosition: OWNER_POSITION,
      });
      const { roles } = buildHarness([everyone], [owner]);

      await expect(roles.remove(owner, everyone.id)).rejects.toMatchObject({ status: 400 });
    });

    it('refuses to rename @everyone', async () => {
      const owner = member({
        isOwner: true,
        permissions: ALL_PERMISSIONS,
        highestPosition: OWNER_POSITION,
      });
      const { roles } = buildHarness([everyone], [owner]);

      await expect(roles.update(owner, everyone.id, { name: 'Peasants' })).rejects.toMatchObject({
        status: 400,
      });
    });

    it('still allows changing @everyone’s permissions', async () => {
      const owner = member({
        isOwner: true,
        permissions: ALL_PERMISSIONS,
        highestPosition: OWNER_POSITION,
      });
      const { roles, updated } = buildHarness([everyone], [owner]);

      await roles.update(owner, everyone.id, { permissions: Permission.VIEW_CHANNEL });

      expect(updated[0]).toMatchObject({ permissions: Permission.VIEW_CHANNEL });
    });
  });

  describe('the audit log', () => {
    it('records a new role against its creator', async () => {
      const actor = member({ permissions: Permission.MANAGE_ROLES, highestPosition: 4 });
      const { roles, audited } = buildHarness([everyone, helper], [actor]);

      const role = await roles.create(actor, { name: 'Greeter' });

      expect(audited).toEqual([
        { serverId: SERVER, actorId: actor.userId, action: 'ROLE_CREATE', targetId: role.id },
      ]);
    });

    it('records a deleted role', async () => {
      const actor = member({ permissions: ALL_PERMISSIONS, highestPosition: 5 });
      const { roles, audited } = buildHarness([everyone, helper], [actor]);

      await roles.remove(actor, helper.id);

      expect(audited).toEqual([
        { serverId: SERVER, actorId: actor.userId, action: 'ROLE_DELETE', targetId: helper.id },
      ]);
    });
  });

  describe('assignment', () => {
    it('refuses to hand out a role at or above the actor', async () => {
      const actor = member({ userId: 'actor', permissions: ALL_PERMISSIONS, highestPosition: 8 });
      const target = member({ userId: 'target', memberId: 'member-target', highestPosition: 0 });
      const { roles } = buildHarness([everyone, senior], [actor, target]);

      await expect(roles.assign(actor, 'target', senior.id)).rejects.toMatchObject({ status: 403 });
    });

    it('refuses to change the roles of a member at the same rank', async () => {
      const actor = member({ userId: 'actor', permissions: ALL_PERMISSIONS, highestPosition: 5 });
      const peer = member({ userId: 'peer', memberId: 'member-peer', highestPosition: 5 });
      const { roles } = buildHarness([everyone, helper], [actor, peer]);

      await expect(roles.assign(actor, 'peer', helper.id)).rejects.toMatchObject({ status: 403 });
    });

    it('assigns a role below the actor to a member below the actor', async () => {
      const actor = member({ userId: 'actor', permissions: ALL_PERMISSIONS, highestPosition: 5 });
      const target = member({ userId: 'target', memberId: 'member-target', highestPosition: 0 });
      const { roles, assigned } = buildHarness([everyone, helper], [actor, target]);

      await roles.assign(actor, 'target', helper.id);

      expect(assigned).toEqual([{ memberId: 'member-target', roleId: helper.id }]);
    });

    /**
     * Handing out an existing role hands out its permissions, so the rule that
     * guards creating and editing one has to guard this too: MANAGE_ROLES plus a
     * single ADMINISTRATOR role below you would otherwise be a one-request path to
     * owning the server.
     */
    it('refuses to assign a role carrying a permission the actor does not hold', async () => {
      const actor = member({
        userId: 'actor',
        permissions: Permission.MANAGE_ROLES,
        highestPosition: 5,
      });
      const target = member({ userId: 'target', memberId: 'member-target', highestPosition: 0 });
      const admin = role({ id: 'admin', name: 'Admin', permissions: ALL_PERMISSIONS, position: 3 });
      const { roles, assigned } = buildHarness([everyone, admin], [actor, target]);

      await expect(roles.assign(actor, 'target', admin.id)).rejects.toThrow(
        /permission you do not have/,
      );
      expect(assigned).toEqual([]);
    });

    /** Assigning it to yourself is the same escalation, and gets the same refusal. */
    it('refuses to assign such a role to the actor themselves', async () => {
      const actor = member({
        userId: 'actor',
        memberId: 'member-actor',
        permissions: Permission.MANAGE_ROLES,
        highestPosition: 5,
      });
      const admin = role({ id: 'admin', name: 'Admin', permissions: ALL_PERMISSIONS, position: 3 });
      const { roles, assigned } = buildHarness([everyone, admin], [actor]);

      await expect(roles.assign(actor, 'actor', admin.id)).rejects.toMatchObject({ status: 403 });
      expect(assigned).toEqual([]);
    });

    /**
     * Taking a role away is not a grant, so it stays a hierarchy question only —
     * otherwise a moderator could not clean up after an escalation they spotted.
     */
    it('still lets a role be taken away that the actor could not have granted', async () => {
      const actor = member({
        userId: 'actor',
        permissions: Permission.MANAGE_ROLES,
        highestPosition: 5,
      });
      const target = member({ userId: 'target', memberId: 'member-target', highestPosition: 0 });
      const admin = role({ id: 'admin', name: 'Admin', permissions: ALL_PERMISSIONS, position: 3 });
      const { roles, unassigned } = buildHarness([everyone, admin], [actor, target]);

      await roles.unassign(actor, 'target', admin.id);

      expect(unassigned).toEqual([{ memberId: 'member-target', roleId: admin.id }]);
    });

    it('reports an unknown member as not found', async () => {
      const actor = member({ userId: 'actor', permissions: ALL_PERMISSIONS, highestPosition: 5 });
      const { roles } = buildHarness([everyone, helper], [actor]);

      await expect(roles.assign(actor, 'ghost', helper.id)).rejects.toMatchObject({ status: 404 });
    });

    it('refuses to take @everyone away from anyone', async () => {
      const owner = member({
        userId: 'owner',
        isOwner: true,
        permissions: ALL_PERMISSIONS,
        highestPosition: OWNER_POSITION,
      });
      const target = member({ userId: 'target', memberId: 'member-target', highestPosition: 0 });
      const { roles } = buildHarness([everyone], [owner, target]);

      await expect(roles.unassign(owner, 'target', everyone.id)).rejects.toMatchObject({
        status: 400,
      });
    });

    /** A role id from another server must not be reachable through this server. */
    it('does not find a role belonging to a different server', async () => {
      const actor = member({ userId: 'actor', permissions: ALL_PERMISSIONS, highestPosition: 5 });
      const foreign = role({ id: 'foreign', serverId: 'server-2', position: 1 });
      const target = member({ userId: 'target', memberId: 'member-target', highestPosition: 0 });
      const { roles } = buildHarness([everyone, foreign], [actor, target]);

      await expect(roles.assign(actor, 'target', 'foreign')).rejects.toMatchObject({ status: 404 });
    });
  });
});
