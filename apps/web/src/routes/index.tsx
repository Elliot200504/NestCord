import { createRoute, redirect } from '@tanstack/react-router';

import { rootRoute } from './root';

/** Nothing lives at "/" — send visitors into the app shell. */
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({
      to: '/app/$serverId/$channelId',
      params: { serverId: 'hq', channelId: 'general' },
    });
  },
});
