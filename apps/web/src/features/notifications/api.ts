import type { NotificationPayload } from '@nestcord/shared';

import { apiRequest } from '@/api/client';

export const notificationsApi = {
  list: () => apiRequest<NotificationPayload[]>('/notifications'),

  readAll: () => apiRequest<void>('/notifications/read', { method: 'POST' }),

  read: (notificationId: string) =>
    apiRequest<void>(`/notifications/${notificationId}/read`, { method: 'POST' }),
};
