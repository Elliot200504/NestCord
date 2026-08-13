import type { Friend, FriendshipStatus, PublicUser } from '@nestcord/shared';

import { PUBLIC_USER_SELECT, toPublicUser } from '../auth/public-user';

export const FRIENDSHIP_SELECT = {
  id: true,
  userId: true,
  friendId: true,
  status: true,
  requestedBy: true,
  createdAt: true,
  user: { select: PUBLIC_USER_SELECT },
  friend: { select: PUBLIC_USER_SELECT },
} as const;

/** A friendship row with both sides attached, as `FRIENDSHIP_SELECT` returns it. */
export interface FriendshipRow {
  id: string;
  userId: string;
  friendId: string;
  status: FriendshipStatus;
  requestedBy: string;
  createdAt: Date;
  user: PublicUser;
  friend: PublicUser;
}

/**
 * Turns a stored row into what one particular person should see.
 *
 * `viewerId` decides both which user is "the other one" and whether a pending
 * request is incoming or outgoing — the same row renders differently for each half
 * of the pair, which is why this takes the viewer rather than being a plain mapper.
 */
export function toFriend(row: FriendshipRow, viewerId: string): Friend {
  return {
    id: row.id,
    user: toPublicUser(row.userId === viewerId ? row.friend : row.user),
    status: row.status,
    direction: row.requestedBy === viewerId ? 'OUTGOING' : 'INCOMING',
    createdAt: row.createdAt.toISOString(),
  };
}
