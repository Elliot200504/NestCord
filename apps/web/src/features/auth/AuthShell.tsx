import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Check } from 'lucide-react';

import { BrandMark } from '@/components/BrandMark';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { stack, stats } from '@/features/landing/landing-content';

interface AuthShellProps {
  title: string;
  description: string;
  headline: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * Shared frame for login and registration: the brand panel sells NestCord, the
 * card gets you in. The copy comes from the landing content so the pages never
 * drift apart.
 */
export function AuthShell({ title, description, headline, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel headline={headline} />

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
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>

          <CardContent>
            {children}
            <div className="text-content-500 mt-6 text-center text-xs">{footer}</div>
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
function BrandPanel({ headline }: { headline: string }) {
  return (
    <section className="relative isolate hidden flex-col justify-center overflow-hidden px-12 py-16 lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 -z-10 size-[38rem] opacity-25"
        style={{
          background: 'radial-gradient(closest-side, var(--color-nest-600) 0%, transparent 100%)',
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
        {headline}
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
