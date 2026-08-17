import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Conversation } from '@nestcord/shared';

import { keys } from '@/api/keys';
import { conversationsApi } from './api';

/**
 * Your conversations, in one request.
 *
 * The list is small and the server already orders it by recent activity, so it is
 * fetched whole rather than paged — the same call the sidebar and the DM view read.
 */
export function useConversations() {
  return useQuery({
    queryKey: keys.conversations,
    queryFn: conversationsApi.list,
  });
}

/**
 * One conversation.
 *
 * Seeded from the list where that is already loaded, so opening a DM from the sidebar
 * renders its title immediately instead of after a second round trip.
 */
export function useConversation(conversationId: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: keys.conversation(conversationId),
    queryFn: () => conversationsApi.find(conversationId),
    initialData: () =>
      queryClient
        .getQueryData<Conversation[]>(keys.conversations)
        ?.find((conversation) => conversation.id === conversationId),
  });
}

/**
 * Opens a DM or a group and puts it in the list.
 *
 * Opening a DM that already exists returns the existing one, so this is safe to call
 * from a "Message" button without checking first — the id it resolves to is the one
 * to navigate to either way.
 */
export function useOpenConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userIds, name }: { userIds: string[]; name?: string }) =>
      conversationsApi.open(userIds, name),

    onSuccess: (conversation) => {
      queryClient.setQueryData(keys.conversation(conversation.id), conversation);

      void queryClient.invalidateQueries({ queryKey: keys.conversations });
    },
  });
}

export function useRenameConversation(conversationId: string) {
  return useConversationMutation(conversationId, (name: string | null) =>
    conversationsApi.rename(conversationId, name),
  );
}

export function useAddParticipants(conversationId: string) {
  return useConversationMutation(conversationId, (userIds: string[]) =>
    conversationsApi.addParticipants(conversationId, userIds),
  );
}

/** Leaves a group and drops it from the list — you can no longer read it. */
export function useLeaveConversation(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => conversationsApi.leave(conversationId),

    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.conversation(conversationId) });
      queryClient.removeQueries({ queryKey: keys.messages(conversationId) });

      void queryClient.invalidateQueries({ queryKey: keys.conversations });
    },
  });
}

/**
 * The shared tail of every mutation that changes a conversation itself: the server's
 * answer replaces the cached copy, and the list is re-read because the change may
 * have moved it.
 */
function useConversationMutation<TInput>(
  conversationId: string,
  mutationFn: (input: TInput) => Promise<Conversation>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,

    onSuccess: (conversation) => {
      queryClient.setQueryData(keys.conversation(conversationId), conversation);

      void queryClient.invalidateQueries({ queryKey: keys.conversations });
    },
  });
}
