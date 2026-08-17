import { createRoute, Outlet } from '@tanstack/react-router';

import { ChannelSidebar } from '../components/ChannelSidebar';
import { ServerRail } from '../components/ServerRail';
import { requireSession } from '../features/auth/require-auth';
import { CreateServerDialog } from '../features/servers/CreateServerDialog';
import { InviteDialog } from '../features/servers/InviteDialog';
import { ServerSettingsDialog } from '../features/servers/ServerSettingsDialog';
import { RealtimeProvider } from '../websocket/RealtimeProvider';
import { rootRoute } from './root';

/** Where the skip link lands, and what names the conversation for a screen reader. */
const CONTENT_ID = 'shell-content';

/**
 * The four-column shell: servers, channels, content, members.
 *
 * `overflow-hidden` keeps the page itself from scrolling — the message list and the
 * side panels scroll inside their own boxes, and a drawer sliding in from off-screen
 * must not widen the document.
 */
function AppLayout() {
  return (
    <RealtimeProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Every server and every channel sits between the top of the page and the
            conversation, which is a long walk by keyboard. Off-screen until focused. */}
        <a
          href={`#${CONTENT_ID}`}
          className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:px-3 focus:py-2 focus:text-sm focus:font-medium"
        >
          Skip to the conversation
        </a>

        <ServerRail />
        <ChannelSidebar />
        <main
          id={CONTENT_ID}
          aria-label="Conversation"
          tabIndex={-1}
          className="bg-surface-700 flex min-w-0 flex-1"
        >
          <Outlet />
        </main>

        {/* Mounted once for the whole shell; each one opens off the UI store. */}
        <CreateServerDialog />
        <InviteDialog />
        <ServerSettingsDialog />
      </div>
    </RealtimeProvider>
  );
}

export const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  // Runs before anything under /app renders, so an unauthenticated visitor never
  // sees a flash of the shell.
  beforeLoad: async ({ location }) => {
    await requireSession(location.href);
  },
  component: AppLayout,
});
