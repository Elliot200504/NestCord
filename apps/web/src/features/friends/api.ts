import type { Friend } from '@nestcord/shared';

import { apiRequest } from '@/api/client';

/**
 * Every route addresses the pair (you, userId), so nothing here takes a friendship
 * id — the caller always knows the person, and the server resolves the row.
 */
export const friendsApi = {
  list: () => apiRequest<Friend[]>('/friends'),

  send: (username: string) =>
    apiRequest<Friend>('/friends', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  accept: (userId: string) => apiRequest<Friend>(`/friends/${userId}/accept`, { method: 'POST' }),

  /** Rejects a request, withdraws yours, or removes a friend — one act on one row. */
  remove: (userId: string) => apiRequest<void>(`/friends/${userId}`, { method: 'DELETE' }),

  block: (userId: string) => apiRequest<Friend>(`/friends/${userId}/block`, { method: 'POST' }),

  unblock: (userId: string) => apiRequest<void>(`/friends/${userId}/block`, { method: 'DELETE' }),
};
