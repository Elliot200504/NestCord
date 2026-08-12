import { Link, useParams } from '@tanstack/react-router';
import { Compass, Plus } from 'lucide-react';

import { serverInitials, useServers } from '@/features/servers/use-servers';
import { cn } from '@/lib/utils';
import { useUiStore } from '../stores/ui-store';

/**
 * Leftmost column: direct messages, then one door per server.
 *
 * Round, not squircle-that-morphs-on-hover. The active room is marked by a red
 * ring rather than a flood fill, so the rail stays quiet and legible.
 */
const DOOR =
  'relative grid size-11 place-items-center rounded-full text-sm font-semibold transition-colors';

const IDLE_DOOR = 'bg-surface-700 text-content-300 hover:text-content-100 hover:bg-surface-600';
const ACTIVE_DOOR = 'bg-primary text-primary-foreground ring-primary/30 ring-4';

export function ServerRail() {
  const params = useParams({ strict: false });
  const openModal = useUiStore((state) => state.openModal);
  const activeServerId = 'serverId' in params ? params.serverId : undefined;
  const { data: servers, isPending, isError } = useServers();

  return (
    <nav
      aria-label="Servers"
      className="bg-surface-900 flex w-[68px] shrink-0 flex-col items-center gap-2.5 py-4"
    >
      <Link
        to="/app/$serverId/$channelId"
        params={{ serverId: '@me', channelId: 'friends' }}
        aria-label="Direct messages"
        className={cn(DOOR, IDLE_DOOR, activeServerId === '@me' && ACTIVE_DOOR)}
      >
        <Compass className="size-5" aria-hidden />
      </Link>

      <div className="bg-border h-px w-7" />

      {isPending && (
        <ul aria-label="Loading servers" className="flex flex-col items-center gap-2.5">
          {[0, 1, 2].map((slot) => (
            <li key={slot} className="bg-surface-700/60 size-11 animate-pulse rounded-full" />
          ))}
        </ul>
      )}

      {isError && (
        <p role="alert" className="text-destructive px-2 text-center text-[0.6rem] leading-tight">
          Could not load your servers
        </p>
      )}

      <ul className="flex flex-col items-center gap-2.5">
        {servers?.map((server) => (
          <li key={server.id}>
            <Link
              to="/app/$serverId"
              params={{ serverId: server.id }}
              title={server.name}
              className={cn(DOOR, IDLE_DOOR, activeServerId === server.id && ACTIVE_DOOR)}
            >
              {server.iconUrl ? (
                <img src={server.iconUrl} alt="" className="size-11 rounded-full object-cover" />
              ) : (
                serverInitials(server)
              )}
              <span className="sr-only">{server.name}</span>
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => openModal('create-server')}
        aria-label="Add a server"
        className={cn(
          DOOR,
          'border-border text-content-500 hover:text-content-100 hover:border-content-500 border border-dashed',
        )}
      >
        <Plus className="size-5" aria-hidden />
      </button>
    </nav>
  );
}
