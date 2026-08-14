import type { Conversation, PublicUser } from '@nestcord/shared';

import { PUBLIC_USER_SELECT, toPublicUser } from '../auth/public-user';

/**
 * Everything a `Conversation` is built from, in one query.
 *
 * The newest message comes back as a single row rather than a count or an aggregate,
 * because the only thing the list needs from it is when it landed — enough to sort
 * the DM list without loading any history.
 */
export const CONVERSATION_SELECT = {
  id: true,
  name: true,
  isGroup: true,
  createdAt: true,
  participants: {
    select: { userId: true, user: { select: PUBLIC_USER_SELECT } },
    orderBy: { joinedAt: 'asc' },
  },
  messages: {
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
} as const;

/** A conversation row with its participants attached, as `CONVERSATION_SELECT` returns it. */
export interface ConversationRow {
  id: string;
  name: string | null;
  isGroup: boolean;
  createdAt: Date;
  participants: Array<{ userId: string; user: PublicUser }>;
  messages: Array<{ createdAt: Date }>;
}

export function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    name: row.name,
    isGroup: row.isGroup,
    participants: row.participants.map((participant) => toPublicUser(participant.user)),
    createdAt: row.createdAt.toISOString(),
    lastMessageAt: row.messages[0]?.createdAt.toISOString() ?? null,
  };
}

/**
 * Newest activity first, an empty conversation sorting by when it was opened.
 *
 * Sorted here rather than in SQL: Prisma cannot order by a related row's timestamp,
 * and nobody has enough DMs for the difference to be measurable.
 */
export function byRecentActivity(a: Conversation, b: Conversation): number {
  return (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt);
}
