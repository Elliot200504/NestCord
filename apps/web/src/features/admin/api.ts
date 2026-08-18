import type { ErrorLogEntry } from '@nestcord/shared';

import { apiRequest } from '@/api/client';

export const adminApi = {
  errors: (before?: string) =>
    apiRequest<ErrorLogEntry[]>(`/admin/errors${before === undefined ? '' : `?before=${before}`}`),

  /** One error by the code a user quoted, however they typed it. */
  error: (reference: string) =>
    apiRequest<ErrorLogEntry>(`/admin/errors/${encodeURIComponent(reference)}`),
};
