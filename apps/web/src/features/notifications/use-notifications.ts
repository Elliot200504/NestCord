import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { NotificationPayload } from '@nestcord/shared';

import { keys } from '@/api/keys';
import { notificationsApi } from './api';

/**
 * Your unread notifications.
 *
 * Fetched once on load and kept current by the socket, which pushes new ones into this
 * same cache entry — so there is no polling.
 */
export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: notificationsApi.list,
  });
}

/** Marks one read, or everything when no id is given. */
export function useReadNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId?: string) =>
      notificationId ? notificationsApi.read(notificationId) : notificationsApi.readAll(),

    // Read is a one-way door and the list only holds unread ones, so the entry is
    // dropped straight away rather than waiting for a refetch.
    onMutate: (notificationId) => {
      queryClient.setQueryData<NotificationPayload[]>(keys.notifications, (current) =>
        notificationId
          ? (current ?? []).filter((notification) => notification.id !== notificationId)
          : [],
      );
    },

    onError: () => queryClient.invalidateQueries({ queryKey: keys.notifications }),
  });
}
