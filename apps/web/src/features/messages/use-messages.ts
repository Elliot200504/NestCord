import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { Message, PublicUser } from '@nestcord/shared';

import { keys } from '@/api/keys';
import type { MessageTransport, SendMessageInput } from './api';
import {
  patchMessage,
  prependMessage,
  readMessages,
  removeMessage,
  replaceMessage,
  toggleReaction,
  writeMessages,
} from './message-cache';

/**
 * Message history, a page at a time (PLAN.MD §8).
 *
 * Every hook here takes a `MessageTransport` rather than a channel: a DM is the same
 * message system reached through different routes, so both get these hooks and only
 * the transport differs.
 *
 * Pages arrive newest-first because that is the order a conversation is read in; the
 * list component reverses them for display. Fetching the next page walks backwards
 * through history, which is what scrolling up asks for.
 */
export function useMessages(transport: MessageTransport, enabled = true) {
  return useInfiniteQuery({
    queryKey: keys.messages(transport.id),
    queryFn: ({ pageParam }) => transport.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

/** Every message in the list, oldest first — the order they are rendered in. */
export function flattenMessages(pages: Array<{ items: Message[] }> | undefined): Message[] {
  return (pages ?? []).flatMap((page) => page.items).reverse();
}

/**
 * Sends a message, showing it immediately (PLAN.MD §25).
 *
 * The optimistic copy is a real `Message` with a generated id, so nothing downstream
 * has to know it is provisional; when the server answers, it is swapped for the row
 * that was actually stored. A failure takes it back out and surfaces the error.
 *
 * Call `submit` rather than `mutate`: it mints the nonce that ties the three copies of
 * this message together — the optimistic one, the response, and the broadcast.
 */
export function useSendMessage(transport: MessageTransport, author: PublicUser) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: SendMessageInput) => transport.send(input),

    onMutate: (input) => {
      const pending = optimisticMessage(input, transport, author);
      prependMessage(queryClient, transport.id, pending);

      return { pendingId: pending.id };
    },

    onSuccess: (sent, _input, context) => {
      if (context) replaceMessage(queryClient, transport.id, context.pendingId, sent);
    },

    onError: (_error, _input, context) => {
      if (context) removeMessage(queryClient, transport.id, context.pendingId);
    },
  });

  return {
    ...mutation,
    /**
     * Shows the message and sends it under a fresh nonce.
     *
     * The nonce is minted here rather than at the call site so the composer does not
     * have to know the protocol, and once rather than per copy so the optimistic
     * message, the response and the broadcast all agree on one id.
     */
    submit: (input: SendMessageInput) => mutation.mutate({ ...input, nonce: crypto.randomUUID() }),
  };
}

export function useEditMessage(transport: MessageTransport) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      transport.edit(messageId, content),

    onSuccess: (edited) => replaceMessage(queryClient, transport.id, edited.id, edited),
  });
}

/**
 * Deletes a message, and only puts it back if the server refuses — a delete that
 * leaves the message on screen for a round trip reads as a broken button.
 */
export function useDeleteMessage(transport: MessageTransport) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => transport.remove(messageId),

    onMutate: (messageId) => {
      const snapshot = readMessages(queryClient, transport.id);
      removeMessage(queryClient, transport.id, messageId);

      return { snapshot };
    },

    onError: (_error, _messageId, context) => {
      if (context?.snapshot) writeMessages(queryClient, transport.id, context.snapshot);
    },
  });
}

/**
 * Adds or takes back the caller's own reaction, whichever the current state calls for.
 *
 * The button state flips before the request so a click feels instant, and the server's
 * grouped list replaces it on the way back.
 */
export function useToggleReaction(transport: MessageTransport) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ message, emoji }: { message: Message; emoji: string }) => {
      const mine = message.reactions.find((reaction) => reaction.emoji === emoji)?.me ?? false;

      return mine
        ? transport.removeReaction(message.id, emoji)
        : transport.addReaction(message.id, emoji);
    },

    onMutate: ({ message, emoji }) => {
      const snapshot = readMessages(queryClient, transport.id);
      patchMessage(queryClient, transport.id, message.id, (current) =>
        toggleReaction(current, emoji),
      );

      return { snapshot };
    },

    onSuccess: (reactions, { message }) =>
      patchMessage(queryClient, transport.id, message.id, (current) => ({ ...current, reactions })),

    onError: (_error, _input, context) => {
      if (context?.snapshot) writeMessages(queryClient, transport.id, context.snapshot);
    },
  });
}

/** Uploads one file and resolves to the attachment id the message needs. */
export function useUploadAttachment(transport: MessageTransport) {
  return useMutation({
    mutationFn: (file: File) => transport.uploadAttachment(file),
  });
}

function optimisticMessage(
  input: SendMessageInput,
  transport: MessageTransport,
  author: PublicUser,
): Message {
  return {
    // The nonce, so the broadcast of this message finds the copy already on screen.
    // Absent only if something called `mutate` directly, where a plain id is fine.
    id: input.nonce ?? crypto.randomUUID(),
    // Which of the two this is does not matter to anything that renders the copy;
    // what matters is that it looks exactly like the message the server will return.
    channelId: transport.kind === 'channel' ? transport.id : null,
    conversationId: transport.kind === 'dm' ? transport.id : null,
    author,
    content: input.content ?? '',
    createdAt: new Date().toISOString(),
    editedAt: null,
    // The reply target and any attachments are only known in full once the server
    // answers, so the provisional copy shows the text and nothing else.
    replyTo: null,
    attachments: [],
    reactions: [],
  };
}
