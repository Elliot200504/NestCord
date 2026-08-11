import { Link, useParams } from '@tanstack/react-router';
import { Compass, Plus } from 'lucide-react';

import { placeholderServers } from '../features/placeholder-data';
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

export function ServerRail() {
  const params = useParams({ strict: false });
  const openModal = useUiStore((state) => state.openModal);
  const activeServerId = 'serverId' in params ? params.serverId : undefined;

  return (
    <nav
      aria-label="Servers"
      className="bg-surface-900 flex w-[68px] shrink-0 flex-col items-center gap-2.5 py-4"
    >
      <Link
        to="/app/$serverId/$channelId"
        params={{ serverId: '@me', channelId: 'friends' }}
        aria-label="Direct messages"
        className={cn(
          DOOR,
          'bg-surface-700 text-content-300 hover:text-content-100 hover:bg-surface-600',
          activeServerId === '@me' && 'bg-primary text-primary-foreground ring-primary/30 ring-4',
        )}
      >
        <Compass className="size-5" aria-hidden />
      </Link>

      <div className="bg-border h-px w-7" />

      <ul className="flex flex-col items-center gap-2.5">
        {placeholderServers.map((server) => (
          <li key={server.id}>
            <Link
              to="/app/$serverId/$channelId"
              params={{ serverId: server.id, channelId: 'general' }}
              title={server.name}
              className={cn(
                DOOR,
                'bg-surface-700 text-content-300 hover:text-content-100 hover:bg-surface-600',
                activeServerId === server.id &&
                  'bg-primary text-primary-foreground ring-primary/30 ring-4',
              )}
            >
              {server.initials}
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
