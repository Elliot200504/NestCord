import type {
  Conversation,
  Message,
  MessageAttachment,
  MessageReaction,
  Paginated,
} from '@nestcord/shared';

import { apiRequest } from '@/api/client';
import type { MessageTransport, SendMessageInput } from '@/features/messages/api';

export const conversationsApi = {
  list: () => apiRequest<Conversation[]>('/conversations'),

  find: (conversationId: string) => apiRequest<Conversation>(`/conversations/${conversationId}`),

  /** One id opens a DM, several open a group. Opening a DM twice returns the same one. */
  open: (userIds: string[], name?: string) =>
    apiRequest<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ userIds, ...(name ? { name } : {}) }),
    }),

  rename: (conversationId: string, name: string | null) =>
    apiRequest<Conversation>(`/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  addParticipants: (conversationId: string, userIds: string[]) =>
    apiRequest<Conversation>(`/conversations/${conversationId}/participants`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    }),

  leave: (conversationId: string) =>
    apiRequest<void>(`/conversations/${conversationId}/participants/me`, { method: 'DELETE' }),
};

/**
 * A conversation's messages, in the shape the message hooks expect.
 *
 * The routes are the channel ones with the server path taken off, which is the whole
 * difference between a DM and a channel as far as the web client is concerned.
 */
export function conversationMessages(conversationId: string): MessageTransport {
  const path = `/conversations/${conversationId}`;

  return {
    kind: 'dm',
    id: conversationId,

    list: (before) =>
      apiRequest<Paginated<Message>>(`${path}/messages${before ? `?before=${before}` : ''}`),

    send: (input: SendMessageInput) =>
      apiRequest<Message>(`${path}/messages`, { method: 'POST', body: JSON.stringify(input) }),

    edit: (messageId, content) =>
      apiRequest<Message>(`${path}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }),

    remove: (messageId) => apiRequest<void>(`${path}/messages/${messageId}`, { method: 'DELETE' }),

    // The emoji is part of the path, so it has to be encoded — most of them are
    // multi-byte, and a few contain characters a URL would otherwise read as syntax.
    addReaction: (messageId, emoji) =>
      apiRequest<MessageReaction[]>(
        `${path}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        { method: 'PUT' },
      ),

    removeReaction: (messageId, emoji) =>
      apiRequest<MessageReaction[]>(
        `${path}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        { method: 'DELETE' },
      ),

    uploadAttachment: (file) => {
      const body = new FormData();
      body.append('file', file);

      return apiRequest<MessageAttachment>(`${path}/attachments`, { method: 'POST', body });
    },
  };
}
