import { createRoute, Outlet } from '@tanstack/react-router';

import { ChannelSidebar } from '../components/ChannelSidebar';
import { ServerRail } from '../components/ServerRail';
import { rootRoute } from './root';

/**
 * The four-column shell: servers, channels, content, members.
 *
 * When authentication lands this route gains a `beforeLoad` guard, so an
 * unauthenticated visitor is redirected before any of it renders.
 */
function AppLayout() {
  return (
    <div className="flex h-full">
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
  component: AppLayout,
});
