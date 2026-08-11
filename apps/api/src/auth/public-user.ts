import type { PublicUser } from '@nestcord/shared';

/**
 * The columns a `PublicUser` is built from. Passing this to Prisma rather than
 * fetching whole rows means `passwordHash` and `email` cannot reach a response
 * through a forgotten `select`.
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  accentColor: true,
  status: true,
} as const;

/** The one place a user row becomes a response body. */
export function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    accentColor: user.accentColor,
    status: user.status,
  };
}
