import { createRoute, useParams } from '@tanstack/react-router';

import { useCurrentUser } from '../features/auth/use-auth';
import { DmComposer } from '../features/dms/DmComposer';
import { DmHeader } from '../features/dms/DmHeader';
import { DmMessageList } from '../features/dms/DmMessageList';
import { useConversation } from '../features/dms/use-conversations';
import { appRoute } from './app';

function ConversationPage() {
  const { conversationId } = useParams({ from: '/app/@me/$conversationId' });
  const { data: conversation, isPending } = useConversation(conversationId);
  const { data: user } = useCurrentUser();

  if (!conversation || !user) {
    return (
      <div className="flex-1 px-6 py-8">
        {isPending ? (
          <p role="status" className="text-content-500 text-sm">
            Loading conversation…
          </p>
        ) : (
          <p role="alert" className="text-destructive text-sm">
            That conversation is not here, or you are not in it.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <DmHeader conversation={conversation} viewerId={user.id} />
      <DmMessageList conversation={conversation} viewerId={user.id} />
      <DmComposer conversation={conversation} author={user} />
    </div>
  );
}

/**
 * `/app/@me/:conversationId` (PLAN.MD §11).
 *
 * Nested under the static `@me` segment, so it never competes with a server id —
 * `friends` is ranked above it by the router because that path is fully static.
 */
export const conversationRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '@me/$conversationId',
  component: ConversationPage,
});
