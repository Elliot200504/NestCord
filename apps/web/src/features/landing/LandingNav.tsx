import { Link } from '@tanstack/react-router';
import { Code } from 'lucide-react';

import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';

export function LandingNav() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-50 border-b backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-6">
        <Link
          to="/"
          className="font-display flex items-center gap-2.5 text-lg font-semibold tracking-tight"
        >
          <BrandMark />
          NestCord
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="text-content-300 hidden rounded-xl sm:inline-flex"
          >
            <a
              href="https://github.com/Elliot200504/NestCord"
              target="_blank"
              rel="noreferrer noopener"
            >
              <Code aria-hidden />
              GitHub
            </a>
          </Button>
          <Button asChild variant="ghost" size="lg" className="text-content-300 rounded-xl">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="lg" className="ml-1 rounded-xl px-4">
            <Link to="/app/$serverId/$channelId" params={{ serverId: 'hq', channelId: 'general' }}>
              Come on in
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
