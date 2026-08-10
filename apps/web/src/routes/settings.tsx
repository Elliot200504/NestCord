import { createRoute, Link } from '@tanstack/react-router';

import { rootRoute } from './root';

/** Placeholder for the settings area (PLAN.MD §11). */
function SettingsPage() {
  return (
    <main className="bg-background grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-content-300 mt-1">Account, profile and appearance land in phase 3.</p>
        <Link
          to="/app/$serverId/$channelId"
          params={{ serverId: 'hq', channelId: 'general' }}
          className="bg-brand-500 hover:bg-brand-600 mt-6 inline-block rounded px-4 py-2 font-medium"
        >
          Back to the app
        </Link>
      </div>
    </main>
  );
}

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});
