import { createRootRoute, Outlet } from '@tanstack/react-router';

/**
 * Each route owns its own sizing: the app shell fills the viewport, the landing
 * page grows with its content. A fixed-height wrapper here would clip one or
 * collapse the other.
 */
export const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-muted-foreground">That route does not exist yet.</p>
      </div>
    </div>
  ),
});
