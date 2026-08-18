import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, LogOut, Palette, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react';

import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useCurrentUser, useLogout } from '@/features/auth/use-auth';
import { UserAvatar } from '@/components/UserAvatar';
import { DEFAULT_APP_ROUTE } from '@/features/auth/require-auth';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { to: '/settings/account', label: 'My account', icon: ShieldCheck },
  { to: '/settings/profile', label: 'Profile', icon: UserRound },
  { to: '/settings/appearance', label: 'Appearance', icon: Palette },
] as const;

/** Only listed for an admin. The route stays reachable by URL either way. */
const ADMIN_SECTION = { to: '/settings/errors', label: 'Error log', icon: TriangleAlert } as const;

/**
 * The settings shell: a column of sections on the left, the open section on the
 * right. Escape closes it, the same way it does in the app this is modelled on.
 */
export function SettingsLayout() {
  const { data: user } = useCurrentUser();
  const { data: access } = useAdminAccess();
  const logout = useLogout();
  const navigate = useNavigate();

  const sections = access?.isAdmin === true ? [...SECTIONS, ADMIN_SECTION] : SECTIONS;

  return (
    <div
      className="bg-background flex min-h-screen"
      onKeyDown={(event) => {
        if (event.key === 'Escape') void navigate(DEFAULT_APP_ROUTE);
      }}
    >
      <nav
        aria-label="Settings"
        className="bg-surface-800 border-border flex w-60 shrink-0 flex-col border-r px-3 py-6"
      >
        <Link
          {...DEFAULT_APP_ROUTE}
          className="text-content-300 hover:text-content-100 mb-6 flex items-center gap-2 px-2.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to NestCord
        </Link>

        {user && (
          <div className="mb-6 flex items-center gap-2.5 px-2.5">
            <UserAvatar user={user} size="md" status={user.status} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.displayName ?? user.username}</p>
              <p className="text-content-500 truncate text-xs">@{user.username}</p>
            </div>
          </div>
        )}

        <ul className="space-y-0.5">
          {sections.map((section) => (
            <li key={section.to}>
              <Link
                to={section.to}
                className="text-content-300 hover:bg-surface-700 hover:text-content-100 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors"
                activeProps={{ className: cn('bg-surface-600 text-content-100') }}
              >
                <section.icon className="size-4 shrink-0" aria-hidden />
                {section.label}
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="text-content-300 hover:bg-surface-700 hover:text-destructive mt-auto flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors disabled:opacity-50"
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          {logout.isPending ? 'Logging out…' : 'Log out'}
        </button>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-10 sm:px-12">
        <div className="mx-auto max-w-2xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
