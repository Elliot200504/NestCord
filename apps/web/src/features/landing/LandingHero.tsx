import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { HeroPreview } from './HeroPreview';
import { stack, stats } from './landing-content';

export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* One warm light, low and to the left, like a lamp in the corner. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-32 -z-10 size-[38rem] opacity-25"
        style={{
          background:
            'radial-gradient(closest-side, var(--color-nest-600) 0%, transparent 100%)',
        }}
      />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pt-20 pb-14 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24 lg:pb-16">
        <div>
          <p className="text-content-300 flex items-center gap-2 text-sm">
            <span className="bg-online size-2 rounded-full" />
            Built slowly, in the open, one phase at a time
          </p>

          <h1 className="font-display mt-6 text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl">
            A small room on the internet that belongs to you.
          </h1>

          <p className="text-content-300 mt-6 max-w-xl text-lg text-pretty">
            NestCord is chat for the handful of people you actually talk to. Servers, channels,
            direct messages, everything live as it happens — running on one modest machine you
            already pay for.
          </p>

          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-11 rounded-xl px-6 text-base">
              <Link to="/app/$serverId/$channelId" params={{ serverId: 'hq', channelId: 'general' }}>
                Come on in
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="text-content-300 h-11 rounded-xl px-5 text-base"
            >
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>

          <p className="text-content-500 mt-10 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="mr-1">Made with</span>
            {stack.map((item, index) => (
              <span key={item}>
                {item}
                {index < stack.length - 1 && <span className="text-content-500/60"> ·</span>}
              </span>
            ))}
          </p>
        </div>

        <HeroPreview />
      </div>

      {/* The three promises, on a shelf across the bottom of the fold. */}
      <div className="border-border mx-auto w-full max-w-6xl border-t px-6">
        <dl className="grid gap-8 py-10 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.value} className="flex gap-3">
              <span aria-hidden className="bg-primary/70 mt-1 h-10 w-0.5 shrink-0 rounded-full" />
              <div>
                <dt className="font-display text-base font-semibold">{stat.value}</dt>
                <dd className="text-content-300 mt-0.5 text-sm">{stat.label}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
