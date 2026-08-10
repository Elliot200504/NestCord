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
          className="mb-8 flex items-center gap-2 font-semibold tracking-tight lg:hidden"
        >
          <BrandMark />
          NestCord
        </Link>

        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Log in to pick up where you left off</CardDescription>
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

              <Button type="submit" disabled className="h-10 w-full text-base">
                Log in
              </Button>
            </form>

            <p className="text-muted-foreground mt-6 text-center text-xs">
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

        <p className="text-muted-foreground mt-8 text-sm">
          <Link to="/" className="hover:text-foreground inline-flex items-center gap-1">
            Back to the landing page
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </p>
      </main>
    </div>
  );
}

/** Left half: the same red glow and grid the landing hero uses. */
function BrandPanel() {
  return (
    <section className="relative isolate hidden flex-col justify-center overflow-hidden px-12 py-16 lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-40 -z-10 w-[42rem] opacity-70"
        style={{
          background:
            'radial-gradient(50% 50% at 30% 40%, var(--color-nest-500) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(60% 60% at 30% 40%, black, transparent)',
        }}
      />

      <Link to="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
        <BrandMark size="lg" />
        NestCord
      </Link>

      <h1 className="mt-10 max-w-md text-4xl font-bold tracking-tight text-balance">
        Your own place to talk.{' '}
        <span className="from-nest-400 to-nest-600 bg-gradient-to-r bg-clip-text text-transparent">
          Nothing you did not build.
        </span>
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
              <p className="font-medium">{stat.value}</p>
              <p className="text-muted-foreground text-sm">{stat.label}</p>
            </div>
          </li>
        ))}
      </ul>

      <ul className="text-muted-foreground mt-12 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
        {stack.map((item) => (
          <li
            key={item}
            className="border-border/70 bg-card/60 rounded-full border px-3 py-1 font-medium"
          >
            {item}
          </li>
        ))}
      </ul>
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
      <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {label}
      </span>
      <input
        type={type}
        name={name}
        autoComplete={autoComplete}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 mt-1.5 w-full rounded-lg border px-3 py-2 outline-none focus-visible:ring-3"
      />
    </label>
  );
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});
