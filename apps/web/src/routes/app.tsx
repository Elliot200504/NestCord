import { createRoute, Outlet } from '@tanstack/react-router';

import { ChannelSidebar } from '../components/ChannelSidebar';
import { ServerRail } from '../components/ServerRail';
import { requireSession } from '../features/auth/require-auth';
import { rootRoute } from './root';

/** The four-column shell: servers, channels, content, members. */
function AppLayout() {
  return (
    <div className="flex h-screen">
      <ServerRail />
      <ChannelSidebar />
      <main className="bg-surface-700 flex min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
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
