import { createRoute, Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { rootRoute } from './root';

/**
 * Placeholder until authentication lands (PLAN.MD §34, phase 2). The form is
 * intentionally inert — there is no auth API to call yet.
 */
function LoginPage() {
  return (
    <main className="bg-background grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>We are happy to see you again</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4">
            <label className="block">
              <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Email
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 mt-1.5 w-full rounded-lg border px-3 py-2 outline-none focus-visible:ring-3"
              />
            </label>

            <label className="block">
              <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Password
              </span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 mt-1.5 w-full rounded-lg border px-3 py-2 outline-none focus-visible:ring-3"
              />
            </label>

            <Button type="submit" disabled className="h-10 w-full text-base">
              Log in
            </Button>

            <p className="text-muted-foreground text-center text-xs">
              Authentication arrives in phase 2.{' '}
              <Link
                to="/app/$serverId/$channelId"
                params={{ serverId: 'hq', channelId: 'general' }}
                className="text-primary hover:underline"
              >
                Skip to the app
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});
