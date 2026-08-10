/**
 * Query key factory. Never inline a key at a call site — that is how cache
 * invalidation silently stops working.
 */
export const keys = {
  health: ['health'] as const,
  me: ['me'] as const,
  servers: ['servers'] as const,
  server: (serverId: string) => ['servers', serverId] as const,
  channels: (serverId: string) => ['servers', serverId, 'channels'] as const,
  members: (serverId: string) => ['servers', serverId, 'members'] as const,
  messages: (channelId: string) => ['messages', channelId] as const,
  friends: ['friends'] as const,
  conversations: ['conversations'] as const,
} as const;
