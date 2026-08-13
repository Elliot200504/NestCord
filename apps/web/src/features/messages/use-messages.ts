import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { Message, PublicUser } from '@nestcord/shared';

import { keys } from '@/api/keys';
import { messagesApi, type SendMessageInput } from './api';
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
 * Channel history, a page at a time (PLAN.MD §8).
 *
 * Pages arrive newest-first because that is the order a channel is read in; the list
 * component reverses them for display. Fetching the next page walks backwards through
 * history, which is what scrolling up asks for.
 */
export function useMessages(serverId: string | null, channelId: string) {
  return useInfiniteQuery({
    queryKey: keys.messages(channelId),
    queryFn: ({ pageParam }) => messagesApi.list(serverId ?? '', channelId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: serverId !== null,
  });
}

/** Every message in the channel, oldest first — the order they are rendered in. */
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
export function useSendMessage(serverId: string, channelId: string, author: PublicUser) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: SendMessageInput) => messagesApi.send(serverId, channelId, input),

    onMutate: (input) => {
      const pending = optimisticMessage(input, channelId, author);
      prependMessage(queryClient, channelId, pending);

      return { pendingId: pending.id };
    },

    onSuccess: (sent, _input, context) => {
      if (context) replaceMessage(queryClient, channelId, context.pendingId, sent);
    },

    onError: (_error, _input, context) => {
      if (context) removeMessage(queryClient, channelId, context.pendingId);
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

export function useEditMessage(serverId: string, channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      messagesApi.edit(serverId, channelId, messageId, content),

    onSuccess: (edited) => replaceMessage(queryClient, channelId, edited.id, edited),
  });
}

/**
 * Deletes a message, and only puts it back if the server refuses — a delete that
 * leaves the message on screen for a round trip reads as a broken button.
 */
export function useDeleteMessage(serverId: string, channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => messagesApi.remove(serverId, channelId, messageId),

    onMutate: (messageId) => {
      const snapshot = readMessages(queryClient, channelId);
      removeMessage(queryClient, channelId, messageId);

      return { snapshot };
    },

    onError: (_error, _messageId, context) => {
      if (context?.snapshot) writeMessages(queryClient, channelId, context.snapshot);
    },
  });
}

/**
 * Adds or takes back the caller's own reaction, whichever the current state calls for.
 *
 * The button state flips before the request so a click feels instant, and the server's
 * grouped list replaces it on the way back.
 */
export function useToggleReaction(serverId: string, channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ message, emoji }: { message: Message; emoji: string }) => {
      const mine = message.reactions.find((reaction) => reaction.emoji === emoji)?.me ?? false;

      return mine
        ? messagesApi.removeReaction(serverId, channelId, message.id, emoji)
        : messagesApi.addReaction(serverId, channelId, message.id, emoji);
    },

    onMutate: ({ message, emoji }) => {
      const snapshot = readMessages(queryClient, channelId);
      patchMessage(queryClient, channelId, message.id, (current) => toggleReaction(current, emoji));

      return { snapshot };
    },

    onSuccess: (reactions, { message }) =>
      patchMessage(queryClient, channelId, message.id, (current) => ({ ...current, reactions })),

    onError: (_error, _input, context) => {
      if (context?.snapshot) writeMessages(queryClient, channelId, context.snapshot);
    },
  });
}

/** Uploads one file and resolves to the attachment id the message needs. */
export function useUploadAttachment(serverId: string, channelId: string) {
  return useMutation({
    mutationFn: (file: File) => messagesApi.uploadAttachment(serverId, channelId, file),
  });
}

function optimisticMessage(
  input: SendMessageInput,
  channelId: string,
  author: PublicUser,
): Message {
  return {
    // The nonce, so the broadcast of this message finds the copy already on screen.
    // Absent only if something called `mutate` directly, where a plain id is fine.
    id: input.nonce ?? crypto.randomUUID(),
    channelId,
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
