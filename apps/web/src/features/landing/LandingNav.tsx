import { Link } from '@tanstack/react-router';
import { Code } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function LandingNav() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-50 border-b backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="bg-primary grid size-8 place-items-center rounded-lg text-sm font-bold text-white"
          >
            N
          </span>
          NestCord
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="lg" className="hidden sm:inline-flex">
            <a
              href="https://github.com/Elliot200504/NestCord"
              target="_blank"
              rel="noreferrer noopener"
            >
              <Code aria-hidden />
              GitHub
            </a>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="lg">
            <Link to="/app/$serverId/$channelId" params={{ serverId: 'hq', channelId: 'general' }}>
              Open NestCord
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
