import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { Message, Paginated } from '@nestcord/shared';

import { keys } from '@/api/keys';

/** How `useInfiniteQuery` holds history: newest page first, newest item first. */
export type MessagePages = InfiniteData<Paginated<Message>, string | undefined>;

/**
 * The cache edits every message mutation shares.
 *
 * `listId` is a channel id or a conversation id: both are UUIDs, so a DM and a
 * channel share this cache space without any chance of collision, and every edit
 * below works the same for either.
 *
 * Sending, editing, reacting and deleting all patch the pages in place rather than
 * invalidating them: an invalidation refetches every page the reader has scrolled
 * through, which would throw away their position for the sake of one changed row.
 */

export function readMessages(queryClient: QueryClient, listId: string): MessagePages | undefined {
  return queryClient.getQueryData<MessagePages>(keys.messages(listId));
}

export function writeMessages(
  queryClient: QueryClient,
  listId: string,
  pages: MessagePages | undefined,
): void {
  queryClient.setQueryData(keys.messages(listId), pages);
}

/**
 * Adds a message that arrived over the socket, unless it is already here.
 *
 * The sender receives its own broadcast, so for them this is a second copy of a
 * message already on screen. It is matched two ways: by id, for a message the cache
 * has seen, and by `nonce`, for one still showing under the provisional id the sender
 * gave it. Matching by nonce is what keeps the sender's own message from appearing
 * twice at all — collapsing the pair later would still have flashed a duplicate.
 */
export function upsertMessage(queryClient: QueryClient, listId: string, message: Message): void {
  const current = readMessages(queryClient, listId);

  if (!current) return;

  const has = (id: string) =>
    current.pages.some((page) => page.items.some((existing) => existing.id === id));

  if (has(message.id)) {
    replaceMessage(queryClient, listId, message.id, message);

    return;
  }

  // Our own send, answered by the broadcast before the request came back. Replacing
  // the provisional copy leaves the message where it already is on screen.
  if (message.nonce && has(message.nonce)) {
    replaceMessage(queryClient, listId, message.nonce, message);

    return;
  }

  prependMessage(queryClient, listId, message);
}

/** Puts a message at the top of the newest page, where the newest message belongs. */
export function prependMessage(queryClient: QueryClient, listId: string, message: Message): void {
  const current = readMessages(queryClient, listId);

  // No page loaded yet means nothing is rendering this list; the first fetch will
  // bring the message with it.
  if (!current?.pages[0]) return;

  writeMessages(queryClient, listId, {
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
 * The broadcast copy is prepended above the provisional one, so which of the two comes
 * first in the page decides nothing — the first slot either meets keeps the message and
 * every later copy of it goes.
 */
export function replaceMessage(
  queryClient: QueryClient,
  listId: string,
  messageId: string,
  next: Message,
): void {
  const current = readMessages(queryClient, listId);
  if (!current) return;

  let kept = false;

  writeMessages(queryClient, listId, {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      items: page.items.flatMap((message) => {
        // Neither the message being replaced nor a duplicate of what replaces it.
        if (message.id !== messageId && message.id !== next.id) return [message];

        if (kept) return [];

        kept = true;

        return [next];
      }),
    })),
  });
}

export function removeMessage(queryClient: QueryClient, listId: string, messageId: string): void {
  const current = readMessages(queryClient, listId);
  if (!current) return;

  writeMessages(queryClient, listId, {
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
  listId: string,
  messageId: string,
  patch: (message: Message) => Message,
): void {
  mapMessages(queryClient, listId, (message) =>
    message.id === messageId ? patch(message) : message,
  );
}

function mapMessages(
  queryClient: QueryClient,
  listId: string,
  map: (message: Message) => Message,
): void {
  const current = readMessages(queryClient, listId);
  if (!current) return;

  writeMessages(queryClient, listId, {
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
            reaction.emoji === emoji ? { emoji, count, me: mine ? false : reaction.me } : reaction,
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
