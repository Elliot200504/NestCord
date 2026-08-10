import { createRoute, Link } from '@tanstack/react-router';

import { rootRoute } from './root';

/**
 * Placeholder until authentication lands (PLAN.MD §34, phase 2). The form is
 * intentionally inert — there is no auth API to call yet.
 */
function LoginPage() {
  return (
    <main className="bg-surface-950 grid h-full place-items-center px-4">
      <div className="bg-surface-700 w-full max-w-md rounded-lg p-8 shadow-xl">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-content-300 mt-1 text-sm">We are happy to see you again</p>

        <form className="mt-6 space-y-4">
          <label className="block">
            <span className="text-content-300 text-xs font-semibold tracking-wide uppercase">
              Email
            </span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              className="bg-surface-950 mt-1 w-full rounded border-none px-3 py-2 outline-none"
            />
          </label>

          <label className="block">
            <span className="text-content-300 text-xs font-semibold tracking-wide uppercase">
              Password
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              className="bg-surface-950 mt-1 w-full rounded border-none px-3 py-2 outline-none"
            />
          </label>

          <button
            type="submit"
            disabled
            className="bg-brand-500 hover:bg-brand-600 w-full rounded py-2.5 font-medium disabled:opacity-60"
          >
            Log in
          </button>

          <p className="text-content-500 text-center text-xs">
            Authentication arrives in phase 2.{' '}
            <Link
              to="/app/$serverId/$channelId"
              params={{ serverId: 'hq', channelId: 'general' }}
              className="text-brand-400 hover:underline"
            >
              Skip to the app
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});
