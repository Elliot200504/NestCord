import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { Message, Paginated } from '@nestcord/shared';

import { keys } from '@/api/keys';

/** How `useInfiniteQuery` holds channel history: newest page first, newest item first. */
export type MessagePages = InfiniteData<Paginated<Message>, string | undefined>;

/**
 * The cache edits every message mutation shares.
 *
 * Sending, editing, reacting and deleting all patch the pages in place rather than
 * invalidating them: an invalidation refetches every page the reader has scrolled
 * through, which would throw away their position for the sake of one changed row.
 */

export function readMessages(
  queryClient: QueryClient,
  channelId: string,
): MessagePages | undefined {
  return queryClient.getQueryData<MessagePages>(keys.messages(channelId));
}

export function writeMessages(
  queryClient: QueryClient,
  channelId: string,
  pages: MessagePages | undefined,
): void {
  queryClient.setQueryData(keys.messages(channelId), pages);
}

/**
 * Adds a message that arrived over the socket, unless it is already here.
 *
 * The sender receives its own broadcast, so this is also the second copy of a message
 * that was shown optimistically. Ignoring an id already in the cache is what stops the
 * two racing into a duplicate.
 */
export function upsertMessage(queryClient: QueryClient, channelId: string, message: Message): void {
  const current = readMessages(queryClient, channelId);

  if (!current) return;

  const known = current.pages.some((page) =>
    page.items.some((existing) => existing.id === message.id),
  );

  if (known) {
    replaceMessage(queryClient, channelId, message.id, message);

    return;
  }

  prependMessage(queryClient, channelId, message);
}

/** Puts a message at the top of the newest page, where the newest message belongs. */
export function prependMessage(
  queryClient: QueryClient,
  channelId: string,
  message: Message,
): void {
  const current = readMessages(queryClient, channelId);

  // No page loaded yet means nothing is rendering this channel; the first fetch
  // will bring the message with it.
  if (!current?.pages[0]) return;

  writeMessages(queryClient, channelId, {
    ...current,
    pages: current.pages.map((page, index) =>
      index === 0 ? { ...page, items: [message, ...page.items] } : page,
    ),
  });
}

/**
 * Replaces one message wherever it sits, leaving every page's shape alone.
 *
 * Any other copy of the incoming message is dropped: swapping a provisional message
 * for the stored one has to collapse the two if the broadcast already delivered it.
 */
export function replaceMessage(
  queryClient: QueryClient,
  channelId: string,
  messageId: string,
  next: Message,
): void {
  const current = readMessages(queryClient, channelId);
  if (!current) return;

  let replaced = false;

  writeMessages(queryClient, channelId, {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      items: page.items.flatMap((message) => {
        if (message.id === messageId) {
          replaced = true;

          return [next];
        }

        // A duplicate of what we are inserting, from the socket having got here first.
        return message.id === next.id && replaced ? [] : [message];
      }),
    })),
  });
}

export function removeMessage(
  queryClient: QueryClient,
  channelId: string,
  messageId: string,
): void {
  const current = readMessages(queryClient, channelId);
  if (!current) return;

  writeMessages(queryClient, channelId, {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      items: page.items.filter((message) => message.id !== messageId),
    })),
  });
}

/** Patches a single message through a function, for the optimistic paths. */
export function patchMessage(
  queryClient: QueryClient,
  channelId: string,
  messageId: string,
  patch: (message: Message) => Message,
): void {
  mapMessages(queryClient, channelId, (message) =>
    message.id === messageId ? patch(message) : message,
  );
}

function mapMessages(
  queryClient: QueryClient,
  channelId: string,
  map: (message: Message) => Message,
): void {
  const current = readMessages(queryClient, channelId);
  if (!current) return;

  writeMessages(queryClient, channelId, {
    ...current,
    pages: current.pages.map((page) => ({ ...page, items: page.items.map(map) })),
  });
}

/**
 * Applies one person's reaction as the socket reported it.
 *
 * `viewerId` decides the `me` flag, which is why the broadcast carries who reacted
 * rather than a grouped list: the same event means something different to each client.
 */
export function applyReaction(
  message: Message,
  emoji: string,
  userId: string,
  viewerId: string,
  added: boolean,
): Message {
  const existing = message.reactions.find((reaction) => reaction.emoji === emoji);
  const mine = userId === viewerId;

  if (added) {
    if (!existing) {
      return { ...message, reactions: [...message.reactions, { emoji, count: 1, me: mine }] };
    }

    // Already counted: the reactor is this viewer and the click was optimistic.
    if (mine && existing.me) return message;

    return {
      ...message,
      reactions: message.reactions.map((reaction) =>
        reaction.emoji === emoji
          ? { emoji, count: reaction.count + 1, me: reaction.me || mine }
          : reaction,
      ),
    };
  }

  if (!existing) return message;
  if (mine && !existing.me) return message;

  const count = existing.count - 1;

  return {
    ...message,
    reactions:
      count === 0
        ? message.reactions.filter((reaction) => reaction.emoji !== emoji)
        : message.reactions.map((reaction) =>
            reaction.emoji === emoji
              ? { emoji, count, me: mine ? false : reaction.me }
              : reaction,
          ),
  };
}

/**
 * The reaction list a message should show the moment its button is clicked, before
 * the server has answered. Adding the first of an emoji appends it; taking the last
 * one back removes the button entirely.
 */
export function toggleReaction(message: Message, emoji: string): Message {
  const existing = message.reactions.find((reaction) => reaction.emoji === emoji);

  if (!existing) {
    return { ...message, reactions: [...message.reactions, { emoji, count: 1, me: true }] };
  }

  const count = existing.me ? existing.count - 1 : existing.count + 1;

  return {
    ...message,
    reactions:
      count === 0
        ? message.reactions.filter((reaction) => reaction.emoji !== emoji)
        : message.reactions.map((reaction) =>
            reaction.emoji === emoji ? { emoji, count, me: !existing.me } : reaction,
          ),
  };
}
