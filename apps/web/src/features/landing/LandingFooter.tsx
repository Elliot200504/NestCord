import { Link } from '@tanstack/react-router';

import { BrandMark } from '@/components/BrandMark';
import { Separator } from '@/components/ui/separator';

export function LandingFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 pb-12">
      <Separator />
      <div className="text-muted-foreground flex flex-col items-center justify-between gap-4 pt-8 text-sm sm:flex-row">
        <p className="flex items-center gap-2">
          <BrandMark size="sm" />
          NestCord — a learning project, built with NestJS and React.
        </p>

        <nav aria-label="Footer" className="flex items-center gap-6">
          <Link to="/login" className="hover:text-foreground transition-colors">
            Log in
          </Link>
          <a
            href="https://github.com/Elliot200504/NestCord"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-foreground transition-colors"
          >
            Source
          </a>
        </nav>
      </div>
    </footer>
  );
}
