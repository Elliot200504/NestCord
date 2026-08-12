import { describe, expect, it } from 'vitest';

import { ALL_PERMISSIONS, Permission } from '@nestcord/shared';

import {
  NO_ROLE_POSITION,
  OWNER_POSITION,
  outranksMember,
  outranksPosition,
  type MemberContext,
} from './member-context';

function member(overrides: Partial<MemberContext> = {}): MemberContext {
  return {
    serverId: 'server-1',
    memberId: 'member-1',
    userId: 'user-1',
    isOwner: false,
    permissions: 0,
    roleIds: [],
    highestPosition: NO_ROLE_POSITION,
    ...overrides,
  };
}

describe('outranksPosition', () => {
  it('allows acting on a role below your own', () => {
    expect(outranksPosition(member({ highestPosition: 5 }), 4)).toBe(true);
  });

  it('refuses a role at your own position, so peers cannot manage each other', () => {
    expect(outranksPosition(member({ highestPosition: 5 }), 5)).toBe(false);
  });

  it('refuses a role above your own', () => {
    expect(outranksPosition(member({ highestPosition: 5 }), 6)).toBe(false);
  });

  it('puts the owner above every real role', () => {
    const owner = member({ isOwner: true, highestPosition: OWNER_POSITION });

    expect(outranksPosition(owner, 1_000_000)).toBe(true);
  });

  it('leaves a member with no roles below position zero', () => {
    expect(outranksPosition(member(), 0)).toBe(false);
  });
});

describe('outranksMember', () => {
  it('lets a higher-positioned member act on a lower one', () => {
    const actor = member({ userId: 'actor', highestPosition: 3 });
    const target = member({ userId: 'target', highestPosition: 1 });

    expect(outranksMember(actor, target)).toBe(true);
  });

  it('refuses two members at the same position', () => {
    const actor = member({ userId: 'actor', highestPosition: 2 });
    const target = member({ userId: 'target', highestPosition: 2 });

    expect(outranksMember(actor, target)).toBe(false);
  });

  it('never lets anyone act on the owner', () => {
    const actor = member({ userId: 'actor', highestPosition: 99 });
    const owner = member({ userId: 'owner', isOwner: true, highestPosition: OWNER_POSITION });

    expect(outranksMember(actor, owner)).toBe(false);
  });

  it('does not let an administrator act on the owner either', () => {
    const admin = member({
      userId: 'admin',
      permissions: ALL_PERMISSIONS,
      highestPosition: 10,
    });
    const owner = member({ userId: 'owner', isOwner: true, highestPosition: OWNER_POSITION });

    expect(outranksMember(admin, owner)).toBe(false);
  });

  /**
   * Hierarchy is position, not permission. An administrator holds every flag but is
   * still not above a higher-positioned role — otherwise the position field would
   * mean nothing for the people most able to abuse it.
   */
  it('does not lift an administrator above a higher-positioned member', () => {
    const admin = member({
      userId: 'admin',
      permissions: ALL_PERMISSIONS | Permission.ADMINISTRATOR,
      highestPosition: 2,
    });
    const senior = member({ userId: 'senior', highestPosition: 7 });

    expect(outranksMember(admin, senior)).toBe(false);
  });

  it('lets the owner act on anyone', () => {
    const owner = member({ userId: 'owner', isOwner: true, highestPosition: OWNER_POSITION });
    const admin = member({ userId: 'admin', permissions: ALL_PERMISSIONS, highestPosition: 50 });

    expect(outranksMember(owner, admin)).toBe(true);
  });
});
