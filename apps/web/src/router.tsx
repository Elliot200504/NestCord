import { createRouter } from '@tanstack/react-router';

import { appRoute } from './routes/app';
import { channelRoute } from './routes/channel';
import { friendsRoute } from './routes/friends';
import { landingRoute } from './routes/landing';
import { loginRoute } from './routes/login';
import { registerRoute } from './routes/register';
import { rootRoute } from './routes/root';
import { serverRoute } from './routes/server';
import { settingsRouteTree } from './routes/settings';

/**
 * Code-based routing: the whole tree is visible in one file, with no codegen
 * step. See PLAN.MD §11 for the routes still to come.
 */
export const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRoute,
  registerRoute,
  settingsRouteTree,
  // `friendsRoute` is static and so wins over `channelRoute`'s parameters.
  appRoute.addChildren([friendsRoute, serverRoute, channelRoute]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
