import { createRoute } from '@tanstack/react-router';

import { FriendsPage } from '../features/friends/FriendsPage';
import { appRoute } from './app';

/**
 * `/app/@me/friends` (PLAN.MD §11).
 *
 * A static path, so the router ranks it above `$serverId/$channelId` — `@me` is not
 * a server and `friends` is not a channel, and this route is what keeps the channel
 * route from having to know that.
 */
export const friendsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '@me/friends',
  component: FriendsPage,
});
