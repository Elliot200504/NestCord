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

/** Replaces one message wherever it sits, leaving every page's shape alone. */
export function replaceMessage(
  queryClient: QueryClient,
  channelId: string,
  messageId: string,
  next: Message,
): void {
  mapMessages(queryClient, channelId, (message) => (message.id === messageId ? next : message));
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
