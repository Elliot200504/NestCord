/**
 * Who a member is in one server, and what they may do there.
 *
 * Built by `PermissionsService` from the database and attached to the request by
 * `ServerPermissionGuard`, so a route resolves permissions once rather than every
 * service re-querying the same rows.
 */
export interface MemberContext {
  serverId: string;
  /** The `ServerMember` row id — what `MemberRole` points at. */
  memberId: string;
  userId: string;
  isOwner: boolean;
  /** Effective server-level permissions, with no channel overrides applied. */
  permissions: number;
  /** Ids of every role the member holds, including `@everyone`. */
  roleIds: string[];
  /** The member's highest role position — the only thing hierarchy looks at. */
  highestPosition: number;
}

/**
 * The owner's effective position. Above every real role, so the owner can always
 * manage anyone, and nobody can ever manage the owner.
 */
export const OWNER_POSITION = Number.MAX_SAFE_INTEGER;

/** A member with no roles at all sits below position 0. */
export const NO_ROLE_POSITION = -1;

/**
 * Hierarchy: may this member act on something at `position`?
 *
 * Strictly greater, so equal positions cannot touch each other — that is what
 * stops two moderators from kicking one another. Note this is deliberately
 * separate from permission flags: ADMINISTRATOR grants every flag but does not
 * lift you above a higher-positioned role.
 */
export function outranksPosition(member: MemberContext, position: number): boolean {
  return member.highestPosition > position;
}

/** May `actor` moderate `target`? Owners are untouchable, including by admins. */
export function outranksMember(actor: MemberContext, target: MemberContext): boolean {
  if (target.isOwner) return false;
  if (actor.isOwner) return true;

  return outranksPosition(actor, target.highestPosition);
}
