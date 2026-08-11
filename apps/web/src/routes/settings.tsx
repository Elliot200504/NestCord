import { createRoute, redirect } from '@tanstack/react-router';

import { requireSession } from '../features/auth/require-auth';
import { useCurrentUser } from '../features/auth/use-auth';
import { AccountSection } from '../features/settings/AccountSection';
import { AppearanceSection } from '../features/settings/AppearanceSection';
import { ProfileSection } from '../features/settings/ProfileSection';
import { SettingsLayout } from '../features/settings/SettingsLayout';
import { rootRoute } from './root';

/** Settings shell (PLAN.MD §11). The sections below render into its outlet. */
export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  beforeLoad: async ({ location }) => {
    await requireSession(location.href);
  },
  component: SettingsLayout,
});

/** `/settings` on its own has nothing to show, so it opens the first section. */
const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/settings/account' });
  },
});

const accountRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'account',
  component: () => <WithCurrentUser>{(user) => <AccountSection user={user} />}</WithCurrentUser>,
});

const profileRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'profile',
  component: () => <WithCurrentUser>{(user) => <ProfileSection user={user} />}</WithCurrentUser>,
});

const appearanceRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'appearance',
  component: AppearanceSection,
});

export const settingsRouteTree = settingsRoute.addChildren([
  settingsIndexRoute,
  accountRoute,
  profileRoute,
  appearanceRoute,
]);

/**
 * Both user-facing sections need the loaded profile before they can render a
 * single field, so they share one loading and error state instead of each
 * inventing their own.
 */
function WithCurrentUser({
  children,
}: {
  children: (user: NonNullable<ReturnType<typeof useCurrentUser>['data']>) => React.ReactNode;
}) {
  const { data: user, isPending, error } = useCurrentUser();

  if (isPending) {
    return <p className="text-content-500 text-sm">Loading your account…</p>;
  }

  if (error || !user) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {error?.message ?? 'Your account could not be loaded.'}
      </p>
    );
  }

  return <>{children(user)}</>;
}
