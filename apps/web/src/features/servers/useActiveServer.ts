import { useParams } from '@tanstack/react-router';

/**
 * The server id in the current route, or null on the DM route.
 *
 * `@me` is a real route segment rather than a server, so everything that fetches
 * server data has to distinguish it. Doing that in one place keeps the check from
 * being re-derived — and eventually mis-derived — in every component.
 */
export function useActiveServerId(): string | null {
  const params = useParams({ strict: false });
  const serverId = 'serverId' in params ? params.serverId : undefined;

  return serverId && serverId !== '@me' ? serverId : null;
}
