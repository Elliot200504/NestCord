import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function LandingCta() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-24">
      {/* A pinned-up note rather than a glowing banner. */}
      <div className="border-primary/25 bg-surface-800/60 rounded-2xl border border-dashed px-7 py-10 sm:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-lg">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-balance">
              The door is unlocked
            </h2>
            <p className="text-content-300 mt-3 text-pretty">
              Clone the repository, start PostgreSQL, run two commands. Half an hour from now you
              could be arguing about where to order dinner from, in a room only your friends know
              about.
            </p>
            <code className="border-border text-content-300 mt-6 inline-block rounded-lg border px-4 py-2 font-mono text-sm">
              pnpm install &amp;&amp; pnpm dev
            </code>
          </div>

          <Button asChild size="lg" className="h-11 shrink-0 rounded-xl px-6 text-base">
            <Link to="/app/$serverId/$channelId" params={{ serverId: 'hq', channelId: 'general' }}>
              Come on in
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
