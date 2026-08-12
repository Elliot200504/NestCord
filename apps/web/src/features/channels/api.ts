import type { Channel, ChannelOverride, ChannelType } from '@nestcord/shared';

import { apiRequest } from '@/api/client';

export interface CreateChannelInput {
  name: string;
  type?: ChannelType;
  topic?: string | null;
  parentId?: string | null;
}

export interface UpdateChannelInput {
  name?: string;
  topic?: string | null;
  position?: number;
  parentId?: string | null;
}

/** An override write is always a full allow/deny pair; both zero removes it. */
export interface OverrideInput {
  allow: number;
  deny: number;
}

export const channelsApi = {
  list: (serverId: string) => apiRequest<Channel[]>(`/servers/${serverId}/channels`),

  create: (serverId: string, input: CreateChannelInput) =>
    apiRequest<Channel>(`/servers/${serverId}/channels`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (serverId: string, channelId: string, input: UpdateChannelInput) =>
    apiRequest<Channel>(`/servers/${serverId}/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  remove: (serverId: string, channelId: string) =>
    apiRequest<void>(`/servers/${serverId}/channels/${channelId}`, { method: 'DELETE' }),

  overrides: (serverId: string, channelId: string) =>
    apiRequest<ChannelOverride[]>(`/servers/${serverId}/channels/${channelId}/permissions`),

  setRoleOverride: (serverId: string, channelId: string, roleId: string, input: OverrideInput) =>
    apiRequest<ChannelOverride[]>(
      `/servers/${serverId}/channels/${channelId}/permissions/roles/${roleId}`,
      { method: 'PUT', body: JSON.stringify(input) },
    ),

  setMemberOverride: (serverId: string, channelId: string, userId: string, input: OverrideInput) =>
    apiRequest<ChannelOverride[]>(
      `/servers/${serverId}/channels/${channelId}/permissions/members/${userId}`,
      { method: 'PUT', body: JSON.stringify(input) },
    ),
};
