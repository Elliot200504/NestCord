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

function channelPath(serverId: string, channelId: string): string {
  return `/servers/${serverId}/channels/${channelId}`;
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
