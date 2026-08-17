import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useRouterState } from '@tanstack/react-router';
import { ChevronDown, Hash, Plus, Users, Volume2 } from 'lucide-react';

import { has, Permission, type Channel } from '@nestcord/shared';

import { useMediaQuery, SHELL_WIDE } from '@/hooks/useMediaQuery';
import { useUiStore } from '@/stores/ui-store';
import { useCurrentUser } from '@/features/auth/use-auth';
import { ChannelMenu } from '@/features/channels/ChannelMenu';
import { ChannelSettingsDialog } from '@/features/channels/ChannelSettingsDialog';
import { CreateChannelDialog } from '@/features/channels/CreateChannelDialog';
import { groupByCategory, useChannels } from '@/features/channels/use-channels';
import { DmList } from '@/features/dms/DmList';
import { incomingCount, useFriends } from '@/features/friends/use-friends';
import { ServerMenu } from '@/features/servers/ServerMenu';
import { useActiveServerId } from '@/features/servers/useActiveServer';
import { useServer } from '@/features/servers/use-servers';
import { cn } from '@/lib/utils';
import { QueryError } from './QueryError';
import { ShellPanel } from './ShellPanel';
import { UserPanel } from './UserPanel';

/** Which dialog the sidebar has open, and what it is about. */
type SidebarDialog =
  { kind: 'create'; parentId: string | null } | { kind: 'settings'; channel: Channel } | null;

export function ChannelSidebar() {
  const params = useParams({ strict: false });
  const routeServerId = 'serverId' in params ? (params.serverId ?? '@me') : '@me';
  const activeChannelId = 'channelId' in params ? params.channelId : undefined;
  const activeConversationId = 'conversationId' in params ? params.conversationId : undefined;

  const activeServerId = useActiveServerId();
  const { data: server } = useServer(activeServerId);
  const channels = useChannels(activeServerId);
  const [dialog, setDialog] = useState<SidebarDialog>(null);

  const wide = useMediaQuery(SHELL_WIDE);
  const drawer = useUiStore((state) => state.drawer);
  const closeDrawer = useUiStore((state) => state.closeDrawer);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const shownFor = useRef(pathname);

  // Picking a channel on a phone should reveal it, not leave the drawer sitting over
  // it. Keyed on the path so every link in here gets this for free — and compared
  // against the last path rather than firing on mount, which would slam the drawer
  // shut the moment it opened.
  useEffect(() => {
    if (shownFor.current === pathname) return;

    shownFor.current = pathname;
    closeDrawer();
  }, [pathname, closeDrawer]);

  const canCreate = server ? has(server.permissions, Permission.MANAGE_CHANNELS) : false;
  const categories = (channels.data ?? []).filter((channel) => channel.type === 'CATEGORY');

  return (
    <>
      <ShellPanel
        side="left"
        wide={wide}
        visible={wide || drawer === 'channels'}
        onClose={closeDrawer}
        closeLabel="Close the channel list"
      >
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
          <DirectMessagesPanel activeConversationId={activeConversationId} />
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
      </ShellPanel>

      {/* Outside the panel: closing the drawer must not tear down an open dialog. */}
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
    </>
  );
}

/**
 * The `@me` sidebar: the Friends link, then your conversations (PLAN.MD §19).
 *
 * The badge counts requests waiting on you, so an incoming request is visible from
 * anywhere in the app rather than only on the page itself.
 */
function DirectMessagesPanel({
  activeConversationId,
}: {
  activeConversationId: string | undefined;
}) {
  const { data: friends } = useFriends();
  const { data: user } = useCurrentUser();
  const waiting = incomingCount(friends ?? []);

  return (
    <nav aria-label="Direct messages" className="flex-1 px-2 py-4">
      <Link
        to="/app/@me/friends"
        activeProps={{ className: 'bg-surface-600 text-content-100' }}
        className="text-content-300 hover:bg-surface-700 hover:text-content-100 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors"
      >
        <Users className="text-content-500 size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate">Friends</span>

        {waiting > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs">
            {waiting}
          </span>
        )}
      </Link>

      {user && <DmList viewerId={user.id} activeConversationId={activeConversationId} />}
    </nav>
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
  const { data: channels, isPending, isError, refetch } = query;

  if (isPending) {
    return (
      <p className="text-content-500 flex-1 px-4 py-4 text-sm" role="status">
        Loading channels…
      </p>
    );
  }

  if (isError || !channels) {
    return (
      <QueryError
        what="the channels for this server"
        onRetry={() => void refetch()}
        className="flex-1 px-4 py-4"
      />
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
