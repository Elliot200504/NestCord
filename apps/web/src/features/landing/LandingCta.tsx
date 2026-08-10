import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function LandingCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-24">
      <div className="border-primary/20 from-nest-700/30 relative isolate overflow-hidden rounded-3xl border bg-gradient-to-br to-transparent px-6 py-16 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{
            background:
              'radial-gradient(50% 80% at 50% 100%, var(--color-nest-500) 0%, transparent 70%)',
          }}
        />

        <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Ready when you are
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-pretty">
          Clone the repository, start PostgreSQL, run two commands, and you have your own chat
          server.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-11 px-6 text-base">
            <Link to="/app/$serverId/$channelId" params={{ serverId: 'hq', channelId: 'general' }}>
              Open NestCord
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <code className="border-border/70 bg-background/70 text-muted-foreground rounded-lg border px-4 py-2.5 font-mono text-sm">
            pnpm install &amp;&amp; pnpm dev
          </code>
        </div>
      </div>
    </section>
  );
}
