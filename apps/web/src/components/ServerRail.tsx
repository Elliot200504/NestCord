import { Link, useParams } from '@tanstack/react-router';
import { Compass, Plus } from 'lucide-react';

import { placeholderServers } from '../features/placeholder-data';
import { cn } from '../lib/cn';
import { useUiStore } from '../stores/ui-store';

/** Leftmost column: direct messages, then one pill per server. */
export function ServerRail() {
  const params = useParams({ strict: false });
  const openModal = useUiStore((state) => state.openModal);
  const activeServerId = 'serverId' in params ? params.serverId : undefined;

  return (
    <nav
      aria-label="Servers"
      className="bg-surface-900 flex w-[72px] shrink-0 flex-col items-center gap-2 py-3"
    >
      <Link
        to="/app/$serverId/$channelId"
        params={{ serverId: '@me', channelId: 'friends' }}
        aria-label="Direct messages"
        className={cn(
          'group grid size-12 place-items-center rounded-3xl transition-all',
          'bg-surface-700 hover:bg-brand-500 hover:rounded-2xl',
          activeServerId === '@me' && 'bg-brand-500 rounded-2xl',
        )}
      >
        <Compass className="size-6" aria-hidden />
      </Link>

      <div className="bg-surface-600 h-0.5 w-8 rounded-full" />

      <ul className="flex flex-col items-center gap-2">
        {placeholderServers.map((server) => (
          <li key={server.id}>
            <Link
              to="/app/$serverId/$channelId"
              params={{ serverId: server.id, channelId: 'general' }}
              title={server.name}
              className={cn(
                'grid size-12 place-items-center rounded-3xl text-sm font-semibold transition-all',
                'bg-surface-700 hover:bg-brand-500 hover:rounded-2xl',
                activeServerId === server.id && 'bg-brand-500 rounded-2xl',
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
        className="bg-surface-700 text-online hover:bg-online grid size-12 place-items-center rounded-3xl transition-all hover:rounded-2xl hover:text-white"
      >
        <Plus className="size-6" aria-hidden />
      </button>
    </nav>
  );
}
