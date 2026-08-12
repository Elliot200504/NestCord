import { resolvePermissions, type PermissionOverride } from '@nestcord/shared';

import type { MemberContext } from './member-context';

/** A `ChannelPermission` row, as far as permission resolution cares. */
export interface OverrideRow {
  type: 'ROLE' | 'MEMBER';
  roleId: string | null;
  userId: string | null;
  allow: number;
  deny: number;
  /** Only needed to tell the `@everyone` override apart from a normal role's. */
  role: { isDefault: boolean } | null;
}

/** The columns `applicableOverrides` reads. */
export const OVERRIDE_CONTEXT_SELECT = {
  type: true,
  roleId: true,
  userId: true,
  allow: true,
  deny: true,
  role: { select: { isDefault: true } },
} as const;

/**
 * Narrow a channel's overrides down to the ones that apply to this member, in the
 * shape `resolvePermissions` expects.
 *
 * `@everyone` is stored as a role override like any other, but it is applied first
 * and separately (PLAN.MD §5), so it is mapped to its own type here.
 */
export function applicableOverrides(
  rows: OverrideRow[],
  member: MemberContext,
): PermissionOverride[] {
  return rows
    .filter((row) =>
      row.type === 'MEMBER'
        ? row.userId === member.userId
        : member.roleIds.includes(row.roleId ?? ''),
    )
    .map((row) => ({
      type: row.type === 'MEMBER' ? 'member' : row.role?.isDefault ? 'everyone' : 'role',
      allow: row.allow,
      deny: row.deny,
    }));
}

/**
 * The member's effective permissions in a channel.
 *
 * Their server-level bits are fed back in as a single role, which resolves to the
 * same union — `resolvePermissions` is the only place the maths lives, in `shared`,
 * so the web client renders from the same rules.
 */
export function resolveChannelPermissions(member: MemberContext, rows: OverrideRow[]): number {
  return resolvePermissions({
    isOwner: member.isOwner,
    roleBits: [member.permissions],
    overrides: applicableOverrides(rows, member),
  });
}
