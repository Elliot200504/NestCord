import type {
  Invite,
  InvitePreview,
  Server,
  ServerMember,
  ServerRole,
  ServerSummary,
} from '@nestcord/shared';

import { apiRequest } from '@/api/client';

export interface CreateInviteInput {
  expiresInHours?: number;
  maxUses?: number;
}

export interface RoleInput {
  name?: string;
  color?: string | null;
  permissions?: number;
  position?: number;
}

export const serversApi = {
  list: () => apiRequest<ServerSummary[]>('/servers'),

  get: (serverId: string) => apiRequest<Server>(`/servers/${serverId}`),

  create: (name: string) =>
    apiRequest<Server>('/servers', { method: 'POST', body: JSON.stringify({ name }) }),

  rename: (serverId: string, name: string) =>
    apiRequest<Server>(`/servers/${serverId}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

  uploadIcon: (serverId: string, file: File) => {
    const body = new FormData();
    body.append('file', file);

    return apiRequest<Server>(`/servers/${serverId}/icon`, { method: 'POST', body });
  },

  removeIcon: (serverId: string) =>
    apiRequest<Server>(`/servers/${serverId}/icon`, { method: 'DELETE' }),

  remove: (serverId: string) => apiRequest<void>(`/servers/${serverId}`, { method: 'DELETE' }),

  leave: (serverId: string) =>
    apiRequest<void>(`/servers/${serverId}/members/@me`, { method: 'DELETE' }),

  members: (serverId: string) => apiRequest<ServerMember[]>(`/servers/${serverId}/members`),

  setNickname: (serverId: string, userId: string, nickname: string | null) =>
    apiRequest<ServerMember>(`/servers/${serverId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ nickname }),
    }),

  kick: (serverId: string, userId: string) =>
    apiRequest<void>(`/servers/${serverId}/members/${userId}`, { method: 'DELETE' }),

  invites: (serverId: string) => apiRequest<Invite[]>(`/servers/${serverId}/invites`),

  createInvite: (serverId: string, input: CreateInviteInput) =>
    apiRequest<Invite>(`/servers/${serverId}/invites`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  revokeInvite: (serverId: string, code: string) =>
    apiRequest<void>(`/servers/${serverId}/invites/${code}`, { method: 'DELETE' }),

  previewInvite: (code: string) => apiRequest<InvitePreview>(`/invites/${code}`),

  joinInvite: (code: string) => apiRequest<Server>(`/invites/${code}`, { method: 'POST' }),

  roles: (serverId: string) => apiRequest<ServerRole[]>(`/servers/${serverId}/roles`),

  createRole: (serverId: string, input: RoleInput & { name: string }) =>
    apiRequest<ServerRole>(`/servers/${serverId}/roles`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateRole: (serverId: string, roleId: string, input: RoleInput) =>
    apiRequest<ServerRole>(`/servers/${serverId}/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  deleteRole: (serverId: string, roleId: string) =>
    apiRequest<void>(`/servers/${serverId}/roles/${roleId}`, { method: 'DELETE' }),

  assignRole: (serverId: string, userId: string, roleId: string) =>
    apiRequest<void>(`/servers/${serverId}/members/${userId}/roles/${roleId}`, { method: 'PUT' }),

  unassignRole: (serverId: string, userId: string, roleId: string) =>
    apiRequest<void>(`/servers/${serverId}/members/${userId}/roles/${roleId}`, {
      method: 'DELETE',
    }),
};
