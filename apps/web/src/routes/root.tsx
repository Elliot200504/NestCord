import { createRootRoute, Outlet } from '@tanstack/react-router';

/**
 * Each route owns its own sizing: the app shell fills the viewport, the landing
 * page grows with its content. A fixed-height wrapper here would clip one or
 * collapse the other.
 */
export const rootRoute = createRootRoute({
  component: Outlet,
  // Without this, a thrown render error anywhere below leaves a blank page and the
  // reader has no way back.
  errorComponent: ({ error, reset }) => (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold">This part of NestCord broke</h1>
        <p className="text-content-300 mt-1.5">
          Something went wrong while rendering. Trying again is usually enough.
        </p>

        {/* The detail is for whoever is debugging; the server logs the real thing. */}
        {import.meta.env.DEV && (
          <pre className="bg-surface-800 text-content-400 mt-4 overflow-x-auto rounded-lg p-3 text-left text-xs">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        )}

        <button
          type="button"
          onClick={reset}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-5 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center">
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold">Nothing behind this door</h1>
        <p className="text-content-300 mt-1.5">That route does not exist yet.</p>
      </div>
    </div>
  ),
});
