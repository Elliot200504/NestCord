import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { DEFAULT_EVERYONE_PERMISSIONS, Permission, type PermissionFlag } from '@nestcord/shared';

import type { MemberContext } from './member-context';
import type { PermissionsService } from './permissions.service';
import { ServerPermissionGuard, type RequestWithMember } from './server-permission.guard';

const SERVER = '11111111-2222-4333-8444-555555555555';
const USER = 'user-ada';

const MEMBER: MemberContext = {
  serverId: SERVER,
  memberId: 'member-ada',
  userId: USER,
  isOwner: false,
  permissions: DEFAULT_EVERYONE_PERMISSIONS,
  roleIds: ['everyone'],
  highestPosition: 0,
};

interface HarnessOptions {
  /** What `@RequirePermission()` put on the route. Null means membership alone. */
  flag?: PermissionFlag | null;
  params?: Record<string, unknown>;
  authenticated?: boolean;
  /** Makes the permissions service refuse, the way a missing flag would. */
  refuseWith?: string;
}

interface Call {
  kind: 'membership' | 'permission';
  serverId: string;
  userId: string;
  flag?: PermissionFlag;
}

function buildHarness(options: HarnessOptions = {}) {
  const { flag = null, params = { serverId: SERVER }, authenticated = true, refuseWith } = options;

  const calls: Call[] = [];

  const request = {
    ...(authenticated ? { user: { id: USER } } : {}),
    params,
  } as unknown as RequestWithMember;

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;

  const reflector = {
    getAllAndOverride: () => flag,
  } as unknown as Reflector;

  const permissions = {
    requireMembership: async (serverId: string, userId: string) => {
      calls.push({ kind: 'membership', serverId, userId });

      return MEMBER;
    },
    requirePermission: async (serverId: string, userId: string, required: PermissionFlag) => {
      calls.push({ kind: 'permission', serverId, userId, flag: required });

      if (refuseWith !== undefined) throw new ForbiddenException(refuseWith);

      return MEMBER;
    },
  } as unknown as PermissionsService;

  return {
    guard: new ServerPermissionGuard(reflector, permissions),
    context,
    request,
    calls,
  };
}

describe('ServerPermissionGuard', () => {
  it('requires membership alone when the route names no flag', async () => {
    const harness = buildHarness({ flag: null });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.calls).toEqual([{ kind: 'membership', serverId: SERVER, userId: USER }]);
  });

  it('checks the flag the route asked for', async () => {
    const harness = buildHarness({ flag: Permission.MANAGE_CHANNELS });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.calls).toEqual([
      {
        kind: 'permission',
        serverId: SERVER,
        userId: USER,
        flag: Permission.MANAGE_CHANNELS,
      },
    ]);
  });

  it('attaches the resolved member to the request, so the handler does not re-query', async () => {
    const harness = buildHarness();

    await harness.guard.canActivate(harness.context);

    expect(harness.request.member).toBe(MEMBER);
  });

  it('refuses an unauthenticated request', async () => {
    const harness = buildHarness({ authenticated: false });

    await expect(harness.guard.canActivate(harness.context)).rejects.toThrow(
      'This route requires authentication',
    );
    expect(harness.calls).toEqual([]);
  });

  it('reports a route with no server id as a bad request, not a missing server', async () => {
    // The decorator on a route whose path has no :serverId — our bug, not the caller's.
    const harness = buildHarness({ params: {} });

    await expect(harness.guard.canActivate(harness.context)).rejects.toThrow(
      'This route is missing a server id',
    );
    expect(harness.calls).toEqual([]);
  });

  it('treats a repeated server id param as a bad request', async () => {
    const harness = buildHarness({ params: { serverId: [SERVER, SERVER] } });

    await expect(harness.guard.canActivate(harness.context)).rejects.toThrow(
      'This route is missing a server id',
    );
    expect(harness.calls).toEqual([]);
  });

  it('rejects a malformed server id before it can reach the database', async () => {
    const harness = buildHarness({ params: { serverId: 'not-a-uuid' } });

    await expect(harness.guard.canActivate(harness.context)).rejects.toThrow('No such server');
    // Nothing was queried: a cast error in Postgres is not how this should surface.
    expect(harness.calls).toEqual([]);
  });

  it('says no more about a malformed id than about a real missing server', async () => {
    const harness = buildHarness({ params: { serverId: "'; drop table servers; --" } });

    await expect(harness.guard.canActivate(harness.context)).rejects.toThrow('No such server');
    expect(harness.calls).toEqual([]);
  });

  it('accepts an uppercase uuid', async () => {
    const harness = buildHarness({ params: { serverId: SERVER.toUpperCase() } });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
  });

  it('lets a refusal from the permissions service through, attaching no member', async () => {
    const harness = buildHarness({
      flag: Permission.ADMINISTRATOR,
      refuseWith: 'You do not have permission to do that in this server',
    });

    await expect(harness.guard.canActivate(harness.context)).rejects.toThrow(
      'You do not have permission to do that in this server',
    );
    expect(harness.request.member).toBeUndefined();
  });
});
