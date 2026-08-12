/**
 * Socket.IO event names, payloads and room helpers.
 *
 * Defined once so the API and the web client cannot drift apart on a string.
 */

import type {
  Message,
  PresenceStatus,
  PublicUser,
  ServerMember,
} from './types.js';
export const SocketEvent = {
  MESSAGE_CREATE: 'message:create',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_DELETE: 'message:delete',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  REACTION_ADD: 'reaction:add',
  REACTION_REMOVE: 'reaction:remove',
  PRESENCE_UPDATE: 'presence:update',
  MEMBER_JOIN: 'member:join',
  MEMBER_LEAVE: 'member:leave',
  NOTIFICATION_CREATE: 'notification:create',
} as const;

export type SocketEventName = (typeof SocketEvent)[keyof typeof SocketEvent];

/**
 * Room membership is the authorization boundary: a socket only joins a room
 * after the server has verified the user may read it.
 */
export const rooms = {
  server: (serverId: string) => `server:${serverId}`,
  channel: (channelId: string) => `channel:${channelId}`,
  dm: (conversationId: string) => `dm:${conversationId}`,
  user: (userId: string) => `user:${userId}`,
} as const;

/**
 * What each broadcast carries.
 *
 * `message:create` and `message:update` send the same `Message` the REST routes
 * return, so a listener can put the payload straight into the cache the channel is
 * already reading from. The rest send the smallest fact that describes the change.
 */

/** A message is gone. The channel is included so the listener knows which cache to patch. */
export interface MessageDeletePayload {
  channelId: string;
  messageId: string;
}

/**
 * One person reacted, or took their reaction back.
 *
 * The fact is broadcast rather than the grouped reaction list, because that list
 * carries a `me` flag which is only true for one viewer — sending it to everyone
 * would tell each client that *they* had reacted. Each client applies the change
 * against its own identity instead.
 */
export interface ReactionPayload {
  channelId: string;
  messageId: string;
  emoji: string;
  /** Who reacted. */
  userId: string;
}

/** Someone is typing in a channel. Never persisted, expired by the receiver. */
export interface TypingPayload {
  channelId: string;
  user: PublicUser;
}

/** What a client sends to say it is typing. */
export interface TypingInput {
  channelId: string;
}

export interface PresencePayload {
  userId: string;
  status: PresenceStatus;
}

export interface MemberJoinPayload {
  serverId: string;
  member: ServerMember;
}

export interface MemberLeavePayload {
  serverId: string;
  userId: string;
}

/** A notification aimed at one person, sent to their own room. */
export interface NotificationPayload {
  id: string;
  type: 'MENTION' | 'FRIEND_REQUEST' | 'DIRECT_MESSAGE' | 'SERVER_INVITE';
  /** Message, friendship or invite id, depending on the type. */
  sourceId: string | null;
  createdAt: string;
  /** Enough to render the notification without a second request. */
  actor: PublicUser | null;
  serverId: string | null;
  channelId: string | null;
  preview: string | null;
}

/** Maps every event name to the payload it carries, for a typed client. */
export interface SocketEventPayloads {
  [SocketEvent.MESSAGE_CREATE]: Message;
  [SocketEvent.MESSAGE_UPDATE]: Message;
  [SocketEvent.MESSAGE_DELETE]: MessageDeletePayload;
  [SocketEvent.TYPING_START]: TypingPayload;
  [SocketEvent.TYPING_STOP]: TypingPayload;
  [SocketEvent.REACTION_ADD]: ReactionPayload;
  [SocketEvent.REACTION_REMOVE]: ReactionPayload;
  [SocketEvent.PRESENCE_UPDATE]: PresencePayload;
  [SocketEvent.MEMBER_JOIN]: MemberJoinPayload;
  [SocketEvent.MEMBER_LEAVE]: MemberLeavePayload;
  [SocketEvent.NOTIFICATION_CREATE]: NotificationPayload;
}

/**
 * How long a typing indicator survives without another `typing:start`.
 *
 * The receiver expires it on this timer rather than waiting for `typing:stop`,
 * because a closed tab or a dropped connection never sends one.
 */
export const TYPING_TIMEOUT_MS = 8_000;

/** How often a client may repeat `typing:start` while someone keeps typing. */
export const TYPING_THROTTLE_MS = 3_000;
