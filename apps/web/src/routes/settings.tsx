import { createRoute, Link } from '@tanstack/react-router';

import { rootRoute } from './root';

/** Placeholder for the settings area (PLAN.MD §11). */
function SettingsPage() {
  return (
    <main className="bg-background grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-content-300 mt-1.5">Account, profile and appearance land in phase 3.</p>
        <Link
          to="/app/$serverId/$channelId"
          params={{ serverId: 'hq', channelId: 'general' }}
          className="bg-primary hover:bg-nest-600 mt-7 inline-block rounded-xl px-5 py-2.5 font-medium transition-colors"
        >
          Back to the conversation
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
