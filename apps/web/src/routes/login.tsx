import { createRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Check } from 'lucide-react';

import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { stack, stats } from '@/features/landing/landing-content';
import { rootRoute } from './root';

/**
 * The login page doubles as the landing page for anyone arriving with an
 * account: the brand panel sells NestCord, the card gets them in. The copy is
 * shared with the landing page so the two never drift apart.
 *
 * The form is intentionally inert — authentication lands in PLAN.MD §34 phase 2.
 */
function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel />

      <main className="flex flex-col justify-center px-6 py-12 sm:px-12">
        {/* The brand panel is hidden on narrow screens, so the mark comes along. */}
        <Link
          to="/"
          className="font-display mb-8 flex items-center gap-2.5 text-lg font-semibold tracking-tight lg:hidden"
        >
          <BrandMark />
          NestCord
        </Link>

        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Everyone is still here. Pick up where you left off.</CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-4">
              <Field label="Email" type="email" name="email" autoComplete="email" />
              <Field
                label="Password"
                type="password"
                name="password"
                autoComplete="current-password"
              />

              <Button type="submit" disabled className="h-10 w-full rounded-xl text-base">
                Log in
              </Button>
            </form>

            <p className="text-content-500 mt-6 text-center text-xs">
              Authentication arrives in phase 2. In the meantime you can{' '}
              <Link
                to="/app/$serverId/$channelId"
                params={{ serverId: 'hq', channelId: 'general' }}
                className="text-primary font-medium hover:underline"
              >
                skip straight to the app
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <p className="text-content-500 mt-8 text-sm">
          <Link to="/" className="hover:text-content-100 inline-flex items-center gap-1">
            Back to the front page
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </p>
      </main>
    </div>
  );
}

/** Left half: the same single warm light the landing hero is lit by. */
function BrandPanel() {
  return (
    <section className="relative isolate hidden flex-col justify-center overflow-hidden px-12 py-16 lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 -z-10 size-[38rem] opacity-25"
        style={{
          background:
            'radial-gradient(closest-side, var(--color-nest-600) 0%, transparent 100%)',
        }}
      />

      <Link
        to="/"
        className="font-display flex items-center gap-3 text-lg font-semibold tracking-tight"
      >
        <BrandMark size="lg" />
        NestCord
      </Link>

      <h1 className="font-display mt-10 max-w-md text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
        A small room on the internet that belongs to you.
      </h1>

      <ul className="mt-10 space-y-4">
        {stats.map((stat) => (
          <li key={stat.value} className="flex items-start gap-3">
            <span
              aria-hidden
              className="bg-primary/10 text-primary mt-0.5 grid size-6 shrink-0 place-items-center rounded-full"
            >
              <Check className="size-3.5" />
            </span>
            <div>
              <p className="font-display font-semibold">{stat.value}</p>
              <p className="text-content-300 text-sm">{stat.label}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-content-500 mt-12 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="mr-1">Made with</span>
        {stack.map((item, index) => (
          <span key={item}>
            {item}
            {index < stack.length - 1 && <span className="text-content-500/60"> ·</span>}
          </span>
        ))}
      </p>
    </section>
  );
}

interface FieldProps {
  label: string;
  type: 'email' | 'password';
  name: string;
  autoComplete: string;
}

function Field({ label, type, name, autoComplete }: FieldProps) {
  return (
    <label className="block">
      <span className="text-content-300 text-sm font-medium">{label}</span>
      <input
        type={type}
        name={name}
        autoComplete={autoComplete}
        className="border-input bg-surface-900/60 focus-visible:border-ring focus-visible:ring-ring/40 mt-1.5 w-full rounded-xl border px-3.5 py-2.5 outline-none focus-visible:ring-3"
      />
    </label>
  );
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});
