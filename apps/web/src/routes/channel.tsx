import { createRoute, useParams } from '@tanstack/react-router';

import { ChannelHeader } from '../components/ChannelHeader';
import { MemberList } from '../components/MemberList';
import { MessageComposer } from '../components/MessageComposer';
import { MessageList } from '../components/MessageList';
import { useChannel } from '../features/channels/use-channels';
import { useActiveServerId } from '../features/servers/useActiveServer';
import { useUiStore } from '../stores/ui-store';
import { appRoute } from './app';

function ChannelPage() {
  const { channelId } = useParams({ from: '/app/$serverId/$channelId' });
  const memberListOpen = useUiStore((state) => state.memberListOpen);
  const serverId = useActiveServerId();
  const { data: channel, isPending } = useChannel(serverId, channelId);

  // The sidebar has the same query, so this is the cached channel rather than a
  // second request. Falling back to the id keeps the header from going blank.
  const channelName = channel?.name ?? (isPending ? '…' : channelId);

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col">
        <ChannelHeader channelName={channelName} topic={channel?.topic ?? undefined} />
        <MessageList />
        <MessageComposer channelName={channelName} />
      </div>
      {memberListOpen && <MemberList />}
    </>
  );
}

export const channelRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '$serverId/$channelId',
  component: ChannelPage,
});
