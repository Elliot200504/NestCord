import type { FormEvent } from 'react';
import { createRoute, Link, useSearch } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { AuthField } from '@/features/auth/AuthField';
import { AuthShell } from '@/features/auth/AuthShell';
import { FormError } from '@/features/auth/FormError';
import { safeRedirect } from '@/features/auth/require-auth';
import { useLogin } from '@/features/auth/use-auth';
import { rootRoute } from './root';

function LoginPage() {
  const { redirect } = useSearch({ from: '/login' });
  const login = useLogin(safeRedirect(redirect));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    login.mutate({
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    });
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Everyone is still here. Pick up where you left off."
      headline="A small room on the internet that belongs to you."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthField label="Email" type="email" name="email" autoComplete="email" required />
        <AuthField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />

        <FormError error={login.error} />

        <Button
          type="submit"
          disabled={login.isPending}
          className="h-10 w-full rounded-xl text-base"
        >
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthShell>
  );
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  // Where to go after signing in, set by the guard on /app.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginPage,
});
