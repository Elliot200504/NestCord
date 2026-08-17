import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/api/client';
import { keys } from '@/api/keys';

/**
 * Whether this account may open the error log.
 *
 * Lives here rather than under `features/admin/` because the settings shell needs
 * it too, to decide whether to list the section at all. Asked once and kept: the
 * answer comes from a config file the server was started with, so it cannot change
 * while the page is open.
 *
 * This only decides what is rendered. The API re-checks it on every admin request.
 */
export function useAdminAccess() {
  return useQuery({
    queryKey: keys.adminAccess,
    queryFn: () => apiRequest<{ isAdmin: boolean }>('/admin/access'),
    staleTime: Infinity,
  });
}
