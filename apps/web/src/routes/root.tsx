import { createRootRoute, Outlet } from '@tanstack/react-router';

export const rootRoute = createRootRoute({
  component: () => (
    <div className="h-full">
      <Outlet />
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid h-full place-items-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-content-300">That route does not exist yet.</p>
      </div>
    </div>
  ),
});
