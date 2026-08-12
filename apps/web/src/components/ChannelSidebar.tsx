import { Link, useParams } from '@tanstack/react-router';
import { ChevronDown, Hash, Volume2 } from 'lucide-react';

import { placeholderChannels } from '../features/placeholder-data';
import { ServerMenu } from '@/features/servers/ServerMenu';
import { useActiveServerId } from '@/features/servers/useActiveServer';
import { useServer } from '@/features/servers/use-servers';
import { cn } from '@/lib/utils';
import { UserPanel } from './UserPanel';

export function ChannelSidebar() {
  const params = useParams({ strict: false });
  const routeServerId = 'serverId' in params ? (params.serverId ?? '@me') : '@me';
  const activeChannelId = 'channelId' in params ? params.channelId : undefined;

  const activeServerId = useActiveServerId();
  const { data: server } = useServer(activeServerId);
  const categories = [...new Set(placeholderChannels.map((channel) => channel.category))];

  return (
    <div className="bg-surface-800 flex w-60 shrink-0 flex-col">
      {server ? (
        <ServerMenu server={server}>
          <button
            type="button"
            className="border-border hover:bg-surface-700 flex h-14 w-full items-center justify-between border-b px-4 text-left transition-colors"
          >
            <h1 className="font-display truncate text-base font-semibold">{server.name}</h1>
            <ChevronDown className="text-content-500 size-4 shrink-0" aria-hidden />
          </button>
        </ServerMenu>
      ) : (
        <header className="border-border flex h-14 items-center border-b px-4">
          <h1 className="font-display truncate text-base font-semibold">
            {activeServerId === null ? 'Direct Messages' : 'Loading…'}
          </h1>
        </header>
      )}

      <nav aria-label="Channels" className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {categories.map((category) => (
          <section key={category}>
            <h2 className="text-content-500 px-2.5 pb-1.5 text-xs font-medium">{category}</h2>
            <ul>
              {placeholderChannels
                .filter((channel) => channel.category === category)
                .map((channel) => {
                  const Icon = channel.type === 'VOICE' ? Volume2 : Hash;
                  return (
                    <li key={channel.id}>
                      <Link
                        to="/app/$serverId/$channelId"
                        params={{ serverId: routeServerId, channelId: channel.id }}
                        className={cn(
                          'text-content-300 hover:bg-surface-700 hover:text-content-100 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                          activeChannelId === channel.id && 'bg-surface-600 text-content-100',
                        )}
                      >
                        <Icon className="text-content-500 size-4 shrink-0" aria-hidden />
                        <span className="truncate">{channel.name}</span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </nav>

      <UserPanel />
    </div>
  );
}
