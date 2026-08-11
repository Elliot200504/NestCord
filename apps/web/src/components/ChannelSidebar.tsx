import { Link, useParams } from '@tanstack/react-router';
import { ChevronDown, Hash, Volume2 } from 'lucide-react';

import { placeholderChannels, placeholderServers } from '../features/placeholder-data';
import { cn } from '@/lib/utils';
import { UserPanel } from './UserPanel';

export function ChannelSidebar() {
  const params = useParams({ strict: false });
  const serverId = 'serverId' in params ? (params.serverId ?? 'hq') : 'hq';
  const activeChannelId = 'channelId' in params ? params.channelId : undefined;

  const server = placeholderServers.find((entry) => entry.id === serverId);
  const categories = [...new Set(placeholderChannels.map((channel) => channel.category))];

  return (
    <div className="bg-surface-800 flex w-60 shrink-0 flex-col">
      <header className="border-border hover:bg-surface-700 flex h-14 items-center justify-between border-b px-4">
        <h1 className="font-display truncate text-base font-semibold">
          {server?.name ?? 'Direct Messages'}
        </h1>
        <ChevronDown className="text-content-500 size-4" aria-hidden />
      </header>

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
                        params={{ serverId, channelId: channel.id }}
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
