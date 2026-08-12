/**
 * Query key factory. Never inline a key at a call site — that is how cache
 * invalidation silently stops working.
 */
export const keys = {
  health: ['health'] as const,
  me: ['me'] as const,
  sessions: ['me', 'sessions'] as const,
  profile: (userId: string) => ['users', userId] as const,
  servers: ['servers'] as const,
  server: (serverId: string) => ['servers', serverId] as const,
  channels: (serverId: string) => ['servers', serverId, 'channels'] as const,
  channelOverrides: (serverId: string, channelId: string) =>
    ['servers', serverId, 'channels', channelId, 'permissions'] as const,
  members: (serverId: string) => ['servers', serverId, 'members'] as const,
  roles: (serverId: string) => ['servers', serverId, 'roles'] as const,
  invites: (serverId: string) => ['servers', serverId, 'invites'] as const,
  invitePreview: (code: string) => ['invites', code] as const,
  messages: (channelId: string) => ['messages', channelId] as const,
  notifications: ['notifications'] as const,
  friends: ['friends'] as const,
  conversations: ['conversations'] as const,
} as const;
