/**
 * Socket.IO event names and room helpers.
 *
 * Defined once so the API and the web client cannot drift apart on a string.
 */
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
