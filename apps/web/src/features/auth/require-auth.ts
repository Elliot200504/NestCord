import { redirect } from '@tanstack/react-router';

import { hasAccessToken, refreshAccessToken } from '@/api/client';

/**
 * Where a visitor lands once they are signed in.
 *
 * The direct-message route rather than a server: which servers someone is in is only
 * known after the rail loads, and `@me` is always there.
 */
export const DEFAULT_APP_PATH = '/app/@me/friends';

/** The same destination in the form TanStack Router type-checks links against. */
export const DEFAULT_APP_ROUTE = {
  to: '/app/$serverId/$channelId',
  params: { serverId: '@me', channelId: 'friends' },
} as const;

/**
 * Guard for authenticated routes. On a fresh page load there is no access token
 * in memory yet, so the refresh cookie gets one chance to produce one before the
 * visitor is sent to the login page.
 */
export async function requireSession(currentPath: string): Promise<void> {
  if (hasAccessToken()) return;
  if (await refreshAccessToken()) return;

  throw redirect({ to: '/login', search: { redirect: currentPath } });
}

/**
 * Only same-site paths are honoured as a post-login destination — an absolute URL
 * in the query string would turn the login page into an open redirect.
 */
export function safeRedirect(target: string | undefined): string {
  if (!target?.startsWith('/') || target.startsWith('//')) return DEFAULT_APP_PATH;

  return target;
}
