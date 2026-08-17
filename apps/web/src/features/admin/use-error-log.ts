import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { ERROR_LOG_PAGE_SIZE, type ErrorLogEntry } from '@nestcord/shared';

import { keys } from '@/api/keys';
import { adminApi } from './api';

/**
 * The error log, a page at a time, newest first.
 *
 * Not kept fresh in the background: an admin reading a stack trace does not want
 * the list reordering under them, and the page has a button to fetch again.
 */
export function useErrorLog() {
  return useInfiniteQuery({
    queryKey: keys.errorLog,
    queryFn: ({ pageParam }) => adminApi.errors(pageParam),
    initialPageParam: undefined as string | undefined,
    // The API has no page metadata here: a short page is the last page, and the
    // cursor for the next one is the id of the oldest row we hold.
    getNextPageParam: (lastPage) =>
      lastPage.length < ERROR_LOG_PAGE_SIZE ? undefined : lastPage.at(-1)?.id,
    refetchOnWindowFocus: false,
  });
}

/**
 * One error by the reference a user quoted.
 *
 * A lookup rather than a filter over what is loaded: the error being reported is
 * often older than the first page, and the reference is exactly enough to find it.
 * Retries are off — a mistyped code is a 404, not a flaky request.
 */
export function useErrorLookup(reference: string) {
  const trimmed = reference.trim().toUpperCase();

  return useQuery({
    queryKey: [...keys.errorLog, 'reference', trimmed],
    queryFn: () => adminApi.error(trimmed),
    enabled: trimmed.length > 0,
    retry: false,
  });
}

/** Every loaded error, newest first — the order they are listed in. */
export function flattenErrors(pages: ErrorLogEntry[][] | undefined): ErrorLogEntry[] {
  return (pages ?? []).flat();
}
