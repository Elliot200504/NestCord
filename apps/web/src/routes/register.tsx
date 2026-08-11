import type { FormEvent } from 'react';
import { createRoute, Link } from '@tanstack/react-router';

import {
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@nestcord/shared';

import { Button } from '@/components/ui/button';
import { AuthField } from '@/features/auth/AuthField';
import { AuthShell } from '@/features/auth/AuthShell';
import { FormError } from '@/features/auth/FormError';
import { DEFAULT_APP_PATH } from '@/features/auth/require-auth';
import { useRegister } from '@/features/auth/use-auth';
import { rootRoute } from './root';

function RegisterPage() {
  const register = useRegister(DEFAULT_APP_PATH);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    register.mutate({
      username: String(form.get('username') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    });
  }

  return (
    <AuthShell
      title="Make yourself at home"
      description="One account, and the door is open."
      headline="Bring your people. We kept the lights on."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthField
          label="Username"
          type="text"
          name="username"
          autoComplete="username"
          minLength={USERNAME_MIN_LENGTH}
          maxLength={USERNAME_MAX_LENGTH}
          pattern={USERNAME_PATTERN.source}
          hint="Letters, digits, dots and underscores."
          required
        />
        <AuthField label="Email" type="email" name="email" autoComplete="email" required />
        <AuthField
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          required
        />

        <FormError error={register.error} />

        <Button
          type="submit"
          disabled={register.isPending}
          className="h-10 w-full rounded-xl text-base"
        >
          {register.isPending ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}

export const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
});
