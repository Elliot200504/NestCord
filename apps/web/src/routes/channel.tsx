import { createRoute, useParams } from '@tanstack/react-router';

import { ChannelHeader } from '../components/ChannelHeader';
import { MemberList } from '../components/MemberList';
import { MessageComposer } from '../components/MessageComposer';
import { MessageList } from '../components/MessageList';
import { placeholderChannels } from '../features/placeholder-data';
import { useUiStore } from '../stores/ui-store';
import { appRoute } from './app';

function ChannelPage() {
  const { channelId } = useParams({ from: '/app/$serverId/$channelId' });
  const memberListOpen = useUiStore((state) => state.memberListOpen);

  const channel = placeholderChannels.find((entry) => entry.id === channelId);
  const channelName = channel?.name ?? channelId;

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col">
        <ChannelHeader channelName={channelName} topic="Pull up a chair" />
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
