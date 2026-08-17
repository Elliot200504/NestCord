import { createRoute, Outlet } from '@tanstack/react-router';

import { ChannelSidebar } from '../components/ChannelSidebar';
import { ServerRail } from '../components/ServerRail';
import { requireSession } from '../features/auth/require-auth';
import { CreateServerDialog } from '../features/servers/CreateServerDialog';
import { InviteDialog } from '../features/servers/InviteDialog';
import { ServerSettingsDialog } from '../features/servers/ServerSettingsDialog';
import { RealtimeProvider } from '../websocket/RealtimeProvider';
import { rootRoute } from './root';

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
        <ServerRail />
        <ChannelSidebar />
        <main className="bg-surface-700 flex min-w-0 flex-1">
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
