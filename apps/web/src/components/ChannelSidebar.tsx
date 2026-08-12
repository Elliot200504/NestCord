import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { ChevronDown, Hash, Plus, Volume2 } from 'lucide-react';

import { has, Permission, type Channel } from '@nestcord/shared';

import { ChannelMenu } from '@/features/channels/ChannelMenu';
import { ChannelSettingsDialog } from '@/features/channels/ChannelSettingsDialog';
import { CreateChannelDialog } from '@/features/channels/CreateChannelDialog';
import { groupByCategory, useChannels } from '@/features/channels/use-channels';
import { ServerMenu } from '@/features/servers/ServerMenu';
import { useActiveServerId } from '@/features/servers/useActiveServer';
import { useServer } from '@/features/servers/use-servers';
import { cn } from '@/lib/utils';
import { UserPanel } from './UserPanel';

/** Which dialog the sidebar has open, and what it is about. */
type SidebarDialog =
  { kind: 'create'; parentId: string | null } | { kind: 'settings'; channel: Channel } | null;

export function ChannelSidebar() {
  const params = useParams({ strict: false });
  const routeServerId = 'serverId' in params ? (params.serverId ?? '@me') : '@me';
  const activeChannelId = 'channelId' in params ? params.channelId : undefined;

  const activeServerId = useActiveServerId();
  const { data: server } = useServer(activeServerId);
  const channels = useChannels(activeServerId);
  const [dialog, setDialog] = useState<SidebarDialog>(null);

  const canCreate = server ? has(server.permissions, Permission.MANAGE_CHANNELS) : false;
  const categories = (channels.data ?? []).filter((channel) => channel.type === 'CATEGORY');

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

      {activeServerId === null ? (
        <p className="text-content-500 flex-1 px-4 py-4 text-sm">
          Direct messages arrive in a later phase.
        </p>
      ) : (
        <ChannelList
          query={channels}
          routeServerId={routeServerId}
          activeChannelId={activeChannelId}
          canCreate={canCreate}
          onCreate={(parentId) => setDialog({ kind: 'create', parentId })}
          onEdit={(channel) => setDialog({ kind: 'settings', channel })}
        />
      )}

      <UserPanel />

      {activeServerId !== null && dialog?.kind === 'create' && (
        <CreateChannelDialog
          open
          serverId={activeServerId}
          parentId={dialog.parentId}
          onClose={() => setDialog(null)}
        />
      )}

      {activeServerId !== null && server && dialog?.kind === 'settings' && (
        <ChannelSettingsDialog
          open
          serverId={activeServerId}
          channel={dialog.channel}
          categories={categories}
          roles={server.roles}
          ownPermissions={dialog.channel.permissions}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function ChannelList({
  query,
  routeServerId,
  activeChannelId,
  canCreate,
  onCreate,
  onEdit,
}: {
  /** The sidebar owns the query so its dialogs can read the categories from it. */
  query: ReturnType<typeof useChannels>;
  routeServerId: string;
  activeChannelId: string | undefined;
  canCreate: boolean;
  onCreate: (parentId: string | null) => void;
  onEdit: (channel: Channel) => void;
}) {
  const { data: channels, isPending, isError } = query;

  if (isPending) {
    return (
      <p className="text-content-500 flex-1 px-4 py-4 text-sm" role="status">
        Loading channels…
      </p>
    );
  }

  if (isError || !channels) {
    return (
      <p className="text-destructive flex-1 px-4 py-4 text-sm" role="alert">
        Could not load the channels for this server.
      </p>
    );
  }

  const groups = groupByCategory(channels);

  return (
    <nav aria-label="Channels" className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
      {canCreate && (
        <button
          type="button"
          onClick={() => onCreate(null)}
          className="text-content-400 hover:bg-surface-700 hover:text-content-100 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors"
        >
          <Plus className="size-4 shrink-0" aria-hidden />
          Create channel
        </button>
      )}

      {groups.length === 0 && (
        <p className="text-content-500 px-2.5 text-sm">
          No channels here yet{canCreate ? ' — create the first one.' : '.'}
        </p>
      )}

      {groups.map(({ category, channels: inGroup }) => (
        <section key={category?.id ?? 'uncategorised'}>
          {category && (
            <ChannelMenu
              channel={category}
              onEdit={() => onEdit(category)}
              onCreateInside={() => onCreate(category.id)}
              trigger="click"
            >
              <button
                type="button"
                className="text-content-500 hover:text-content-100 flex w-full items-center gap-1 px-2.5 pb-1.5 text-left text-xs font-medium transition-colors"
              >
                <span className="truncate uppercase">{category.name}</span>
              </button>
            </ChannelMenu>
          )}

          <ul>
            {inGroup.map((channel) => (
              <li key={channel.id}>
                <ChannelMenu channel={channel} onEdit={() => onEdit(channel)}>
                  <Link
                    to="/app/$serverId/$channelId"
                    params={{ serverId: routeServerId, channelId: channel.id }}
                    className={cn(
                      'text-content-300 hover:bg-surface-700 hover:text-content-100 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                      activeChannelId === channel.id && 'bg-surface-600 text-content-100',
                    )}
                  >
                    {channel.type === 'VOICE' ? (
                      <Volume2 className="text-content-500 size-4 shrink-0" aria-hidden />
                    ) : (
                      <Hash className="text-content-500 size-4 shrink-0" aria-hidden />
                    )}
                    <span className="truncate">{channel.name}</span>
                  </Link>
                </ChannelMenu>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
