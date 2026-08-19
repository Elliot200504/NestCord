import { useEffect } from 'react';
import { createRoute, useNavigate, useParams } from '@tanstack/react-router';

import { OpenChannelsButton } from '../components/ShellButtons';
import { useChannels } from '../features/channels/use-channels';
import { appRoute } from './app';

/**
 * `/app/:serverId` with no channel: land on the first text channel the member can
 * see.
 *
 * Which channel that is only becomes known once the list has loaded, so the
 * redirect happens here rather than in `beforeLoad` — and everything that links to a
 * server can link to the server itself instead of guessing at a channel id.
 */
function ServerPage() {
  const { serverId } = useParams({ from: '/app/$serverId' });
  // `@me` is the DM route, not a server, so there are no channels to fetch for it.
  const isDirectMessages = serverId === '@me';
  const { data: channels, isPending, isError } = useChannels(isDirectMessages ? null : serverId);
  const navigate = useNavigate();

  const first = channels?.find((channel) => channel.type === 'TEXT') ?? null;

  useEffect(() => {
    if (!first) return;

    // `replace` so the back button leaves the server rather than bouncing through
    // this redirect again.
    void navigate({
      to: '/app/$serverId/$channelId',
      params: { serverId, channelId: first.id },
      replace: true,
    });
  }, [first, navigate, serverId]);

  if (isDirectMessages) {
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <ServerPageHeader />
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-content-500 text-sm">Direct messages arrive in a later phase.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <ServerPageHeader />
      <div className="flex flex-1 items-center justify-center px-6">
        {isPending && (
          <p role="status" className="text-content-500 text-sm">
            Loading channels…
          </p>
        )}

        {isError && (
          <p role="alert" className="text-destructive text-sm">
            Could not load the channels for this server.
          </p>
        )}

        {!isPending && !isError && !first && (
          <p className="text-content-500 max-w-sm text-center text-sm">
            There is no text channel you can see here yet. Someone with permission to manage
            channels can create one.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Neither branch above has a header of its own, so on a narrow viewport — where the
 * rail and channel list are a closed drawer — this is the only way back to them.
 */
function ServerPageHeader() {
  return (
    <header className="border-border flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden">
      <OpenChannelsButton />
    </header>
  );
}

export const serverRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '$serverId',
  component: ServerPage,
});
