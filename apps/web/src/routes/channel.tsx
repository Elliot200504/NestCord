import { createRoute, useParams } from '@tanstack/react-router';

import { ChannelHeader } from '../components/ChannelHeader';
import { MemberList } from '../components/MemberList';
import { useChannel } from '../features/channels/use-channels';
import { useCurrentUser } from '../features/auth/use-auth';
import { MessageComposer } from '../features/messages/MessageComposer';
import { MessageList } from '../features/messages/MessageList';
import { TypingIndicator } from '../features/messages/TypingIndicator';
import { useActiveServerId } from '../features/servers/useActiveServer';
import { appRoute } from './app';

function ChannelPage() {
  const { channelId } = useParams({ from: '/app/$serverId/$channelId' });
  const serverId = useActiveServerId();
  const { data: channel, isPending } = useChannel(serverId, channelId);
  const { data: user } = useCurrentUser();

  // The sidebar has the same query, so this is the cached channel rather than a
  // second request. Falling back to the id keeps the header from going blank.
  const channelName = channel?.name ?? (isPending ? '…' : channelId);

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col">
        <ChannelHeader channelName={channelName} topic={channel?.topic ?? undefined} />

        {/* Messages need the channel's resolved permissions, so they wait for it. */}
        {serverId && channel && user ? (
          <>
            <MessageList serverId={serverId} channel={channel} viewerId={user.id} />
            <TypingIndicator channelId={channel.id} viewerId={user.id} />
            <MessageComposer serverId={serverId} channel={channel} author={user} />
          </>
        ) : (
          <div className="flex-1 px-6 py-8">
            {!isPending && !channel && (
              <p role="alert" className="text-destructive text-sm">
                That channel is not here, or you cannot see it.
              </p>
            )}
          </div>
        )}
      </div>
      {/* The list decides for itself whether it is a column or an overlay. */}
      <MemberList />
    </>
  );
}

export const channelRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '$serverId/$channelId',
  component: ChannelPage,
});
