import type { Message, MessageAttachment, MessageReaction, Paginated } from '@nestcord/shared';

import { apiRequest } from '@/api/client';

export interface SendMessageInput {
  content?: string;
  replyToId?: string;
  attachmentIds?: string[];
  /**
   * The id the optimistic copy is already showing under. The server echoes it back,
   * which is how the broadcast is recognised as this send rather than a new message.
   */
  nonce?: string;
}

/**
 * The routes one message list talks to, and the cache key it lives under.
 *
 * A channel and a DM are the same message system reached through different paths
 * (PLAN.MD §19), so the hooks take one of these rather than knowing about either.
 * `id` is a channel id or a conversation id — both are UUIDs, so they share the
 * `['messages', id]` cache space without colliding.
 */
export interface MessageTransport {
  /** Which of the two this is — the optimistic copy has to be shaped accordingly. */
  kind: 'channel' | 'dm';
  id: string;
  list: (before?: string) => Promise<Paginated<Message>>;
  send: (input: SendMessageInput) => Promise<Message>;
  edit: (messageId: string, content: string) => Promise<Message>;
  remove: (messageId: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<MessageReaction[]>;
  removeReaction: (messageId: string, emoji: string) => Promise<MessageReaction[]>;
  uploadAttachment: (file: File) => Promise<MessageAttachment>;
}

function channelPath(serverId: string, channelId: string): string {
  return `/servers/${serverId}/channels/${channelId}`;
}

/** A channel's messages, as the hooks want them. */
export function channelMessages(serverId: string, channelId: string): MessageTransport {
  return {
    kind: 'channel',
    id: channelId,
    list: (before) => messagesApi.list(serverId, channelId, before),
    send: (input) => messagesApi.send(serverId, channelId, input),
    edit: (messageId, content) => messagesApi.edit(serverId, channelId, messageId, content),
    remove: (messageId) => messagesApi.remove(serverId, channelId, messageId),
    addReaction: (messageId, emoji) =>
      messagesApi.addReaction(serverId, channelId, messageId, emoji),
    removeReaction: (messageId, emoji) =>
      messagesApi.removeReaction(serverId, channelId, messageId, emoji),
    uploadAttachment: (file) => messagesApi.uploadAttachment(serverId, channelId, file),
  };
}

export const messagesApi = {
  /** One page of history, newest first. `before` is the previous page's cursor. */
  list: (serverId: string, channelId: string, before?: string) => {
    const query = before ? `?before=${before}` : '';

    return apiRequest<Paginated<Message>>(`${channelPath(serverId, channelId)}/messages${query}`);
  },

  send: (serverId: string, channelId: string, input: SendMessageInput) =>
    apiRequest<Message>(`${channelPath(serverId, channelId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  edit: (serverId: string, channelId: string, messageId: string, content: string) =>
    apiRequest<Message>(`${channelPath(serverId, channelId)}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  remove: (serverId: string, channelId: string, messageId: string) =>
    apiRequest<void>(`${channelPath(serverId, channelId)}/messages/${messageId}`, {
      method: 'DELETE',
    }),

  // The emoji is part of the path, so it has to be encoded — most of them are
  // multi-byte, and a few contain characters a URL would otherwise read as syntax.
  addReaction: (serverId: string, channelId: string, messageId: string, emoji: string) =>
    apiRequest<MessageReaction[]>(
      `${channelPath(serverId, channelId)}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      { method: 'PUT' },
    ),

  removeReaction: (serverId: string, channelId: string, messageId: string, emoji: string) =>
    apiRequest<MessageReaction[]>(
      `${channelPath(serverId, channelId)}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      { method: 'DELETE' },
    ),

  /** Uploads a file and returns the id to send with the message that carries it. */
  uploadAttachment: (serverId: string, channelId: string, file: File) => {
    const body = new FormData();
    body.append('file', file);

    return apiRequest<MessageAttachment>(`${channelPath(serverId, channelId)}/attachments`, {
      method: 'POST',
      body,
    });
  },
};
