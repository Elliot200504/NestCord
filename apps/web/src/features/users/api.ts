import type { CurrentUser, PresenceStatus, UserProfile, UserSession } from '@nestcord/shared';

import { apiRequest } from '@/api/client';

export interface UpdateProfileInput {
  username?: string;
  displayName?: string | null;
  bio?: string | null;
  accentColor?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const usersApi = {
  me: () => apiRequest<CurrentUser>('/users/me'),

  profile: (userId: string) => apiRequest<UserProfile>(`/users/${userId}`),

  updateProfile: (input: UpdateProfileInput) =>
    apiRequest<CurrentUser>('/users/me', { method: 'PATCH', body: JSON.stringify(input) }),

  updateStatus: (status: PresenceStatus) =>
    apiRequest<CurrentUser>('/users/me/status', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  changePassword: (input: ChangePasswordInput) =>
    apiRequest<void>('/users/me/password', { method: 'PATCH', body: JSON.stringify(input) }),

  uploadAvatar: (file: File) => {
    const body = new FormData();
    body.append('file', file);

    return apiRequest<CurrentUser>('/users/me/avatar', { method: 'POST', body });
  },

  removeAvatar: () => apiRequest<CurrentUser>('/users/me/avatar', { method: 'DELETE' }),

  sessions: () => apiRequest<UserSession[]>('/users/me/sessions'),

  revokeSession: (sessionId: string) =>
    apiRequest<void>(`/users/me/sessions/${sessionId}`, { method: 'DELETE' }),

  revokeOtherSessions: () => apiRequest<void>('/users/me/sessions', { method: 'DELETE' }),
};
