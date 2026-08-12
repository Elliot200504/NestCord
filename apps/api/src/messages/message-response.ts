import type {
  Message,
  MessageAttachment,
  MessageReaction,
  MessageReference,
  PublicUser,
} from '@nestcord/shared';

import { ATTACHMENT_SELECT, toAttachment } from '../attachments/attachment-response';
import { PUBLIC_USER_SELECT, toPublicUser } from '../auth/public-user';

/**
 * Everything a `Message` is built from, in one query.
 *
 * Reactions come back as raw rows rather than a grouped count: PostgreSQL could
 * group them, but that would be a second query per page, and grouping a page's worth
 * of rows in memory is free at this scale.
 */
export const MESSAGE_SELECT = {
  id: true,
  channelId: true,
  content: true,
  createdAt: true,
  editedAt: true,
  author: { select: PUBLIC_USER_SELECT },
  replyTo: {
    select: {
      id: true,
      content: true,
      author: { select: PUBLIC_USER_SELECT },
    },
  },
  attachments: { select: ATTACHMENT_SELECT, orderBy: { createdAt: 'asc' } },
  // Ordered so `groupReactions` can keep the buttons in a stable order.
  reactions: { select: { emoji: true, userId: true }, orderBy: { createdAt: 'asc' } },
} as const;

export interface MessageRow {
  id: string;
  channelId: string | null;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  author: PublicUser;
  replyTo: { id: string; content: string; author: PublicUser } | null;
  attachments: MessageAttachment[];
  reactions: Array<{ emoji: string; userId: string }>;
}

/**
 * The one place a message row becomes a response body.
 *
 * `viewerId` is needed because a reaction is rendered differently for the person who
 * added it, so the answer to "did I react" is resolved here rather than by shipping
 * every reactor's id to the client.
 */
export function toMessage(message: MessageRow, viewerId: string): Message {
  return {
    id: message.id,
    // Non-null in practice: these routes only ever load channel messages, and a
    // conversation message cannot be reached through them.
    channelId: message.channelId ?? '',
    author: toPublicUser(message.author),
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    replyTo: toMessageReference(message.replyTo),
    attachments: message.attachments.map(toAttachment),
    reactions: groupReactions(message.reactions, viewerId),
  };
}

function toMessageReference(
  replyTo: { id: string; content: string; author: PublicUser } | null,
): MessageReference | null {
  if (!replyTo) return null;

  return {
    id: replyTo.id,
    author: toPublicUser(replyTo.author),
    content: replyTo.content,
  };
}

/**
 * Reaction rows collapsed to one entry per emoji, in the order each emoji was first
 * reacted with — so the buttons do not reshuffle as counts change.
 */
export function groupReactions(
  rows: Array<{ emoji: string; userId: string }>,
  viewerId: string,
): MessageReaction[] {
  const grouped = new Map<string, MessageReaction>();

  for (const row of rows) {
    const current = grouped.get(row.emoji) ?? { emoji: row.emoji, count: 0, me: false };

    grouped.set(row.emoji, {
      emoji: row.emoji,
      count: current.count + 1,
      me: current.me || row.userId === viewerId,
    });
  }

  return [...grouped.values()];
}
