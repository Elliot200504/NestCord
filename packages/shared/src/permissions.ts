/**
 * Discord-style permission flags, stored as a bitfield on Role.permissions.
 *
 * This is the single definition used by the API guard, the Socket.IO gateway and
 * the web client. Never duplicate it — see .claude/skills/permissions-model.
 */
export const Permission = {
  VIEW_CHANNEL: 1 << 0,
  SEND_MESSAGES: 1 << 1,
  MANAGE_MESSAGES: 1 << 2,
  ATTACH_FILES: 1 << 3,
  ADD_REACTIONS: 1 << 4,
  CONNECT: 1 << 5,
  SPEAK: 1 << 6,
  MANAGE_CHANNELS: 1 << 7,
  MANAGE_SERVER: 1 << 8,
  MANAGE_ROLES: 1 << 9,
  KICK_MEMBERS: 1 << 10,
  BAN_MEMBERS: 1 << 11,
  ADMINISTRATOR: 1 << 12,
} as const;

export type PermissionName = keyof typeof Permission;
export type PermissionFlag = (typeof Permission)[PermissionName];

export const PERMISSION_NAMES = Object.keys(Permission) as PermissionName[];

/** Every flag OR-ed together. */
export const ALL_PERMISSIONS = Object.values(Permission).reduce((acc, flag) => acc | flag, 0);

/** Sensible defaults for a newly created @everyone role. */
export const DEFAULT_EVERYONE_PERMISSIONS =
  Permission.VIEW_CHANNEL |
  Permission.SEND_MESSAGES |
  Permission.ATTACH_FILES |
  Permission.ADD_REACTIONS |
  Permission.CONNECT |
  Permission.SPEAK;

/** A single channel-level override, from a role or a specific member. */
export interface PermissionOverride {
  type: 'everyone' | 'role' | 'member';
  allow: number;
  deny: number;
}

export interface ResolvePermissionsInput {
  /** Server owners bypass everything. */
  isOwner: boolean;
  /** Permission bitfields of every role the member has, including @everyone. */
  roleBits: number[];
  /** Channel overrides. Order within the array does not matter. */
  overrides?: PermissionOverride[];
}

/**
 * Resolve a member's effective permissions in a channel.
 *
 * Order: owner -> role union -> ADMINISTRATOR bypass -> @everyone override ->
 * role overrides -> member override. Losing VIEW_CHANNEL clears everything else,
 * because a channel you cannot see grants nothing.
 */
export function resolvePermissions({
  isOwner,
  roleBits,
  overrides = [],
}: ResolvePermissionsInput): number {
  if (isOwner) return ALL_PERMISSIONS;

  const base = roleBits.reduce((acc, bits) => acc | bits, 0);
  if ((base & Permission.ADMINISTRATOR) !== 0) return ALL_PERMISSIONS;

  let bits = base;

  const everyone = overrides.filter((o) => o.type === 'everyone');
  const roles = overrides.filter((o) => o.type === 'role');
  const members = overrides.filter((o) => o.type === 'member');

  for (const override of everyone) {
    bits = (bits & ~override.deny) | override.allow;
  }

  const roleDeny = roles.reduce((acc, o) => acc | o.deny, 0);
  const roleAllow = roles.reduce((acc, o) => acc | o.allow, 0);
  bits = (bits & ~roleDeny) | roleAllow;

  for (const override of members) {
    bits = (bits & ~override.deny) | override.allow;
  }

  if ((bits & Permission.VIEW_CHANNEL) === 0) return 0;

  return bits;
}

/** ADMINISTRATOR implies every other permission. */
export function has(bits: number, flag: PermissionFlag): boolean {
  return (bits & Permission.ADMINISTRATOR) !== 0 || (bits & flag) !== 0;
}

/** List the flag names contained in a bitfield — useful for debugging and tests. */
export function toPermissionNames(bits: number): PermissionName[] {
  return PERMISSION_NAMES.filter((name) => (bits & Permission[name]) !== 0);
}
