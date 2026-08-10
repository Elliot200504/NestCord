import { Link } from '@tanstack/react-router';
import { ArrowRight, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { stack, stats } from './landing-content';

export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Red glow bleeding out of the black background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[36rem] opacity-70"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 0%, var(--color-nest-500) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(70% 50% at 50% 0%, black, transparent)',
        }}
      />

      <div className="mx-auto w-full max-w-4xl px-6 py-24 text-center sm:py-32">
        <Badge variant="outline" className="border-primary/40 text-primary mb-6 gap-1.5">
          <Sparkles aria-hidden className="size-3.5" />
          Built in the open, one phase at a time
        </Badge>

        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          Your own place to talk.{' '}
          <span className="from-nest-400 to-nest-600 bg-gradient-to-r bg-clip-text text-transparent">
            Nothing you did not build.
          </span>
        </h1>

        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg text-pretty">
          NestCord is a self-hosted chat app for small groups — servers, channels, direct messages
          and realtime everything, running on one modest server you control.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-11 px-6 text-base">
            <Link to="/app/$serverId/$channelId" params={{ serverId: 'hq', channelId: 'general' }}>
              Open NestCord
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 px-6 text-base">
            <Link to="/login">Create an account</Link>
          </Button>
        </div>

        <ul className="text-muted-foreground mt-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs">
          {stack.map((item) => (
            <li
              key={item}
              className="border-border/70 bg-card/60 rounded-full border px-3 py-1 font-medium"
            >
              {item}
            </li>
          ))}
        </ul>

        <dl className="mx-auto mt-16 grid max-w-3xl gap-8 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.value}>
              <dt className="text-primary text-xl font-semibold">{stat.value}</dt>
              <dd className="text-muted-foreground mt-1 text-sm">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
