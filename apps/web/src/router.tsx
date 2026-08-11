import { createRouter } from '@tanstack/react-router';

import { appRoute } from './routes/app';
import { channelRoute } from './routes/channel';
import { landingRoute } from './routes/landing';
import { loginRoute } from './routes/login';
import { registerRoute } from './routes/register';
import { rootRoute } from './routes/root';
import { settingsRoute } from './routes/settings';

/**
 * Code-based routing: the whole tree is visible in one file, with no codegen
 * step. See PLAN.MD §11 for the routes still to come.
 */
export const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRoute,
  registerRoute,
  settingsRoute,
  appRoute.addChildren([channelRoute]),
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
