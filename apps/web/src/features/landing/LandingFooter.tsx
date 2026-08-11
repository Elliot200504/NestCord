import { Link } from '@tanstack/react-router';

import { BrandMark } from '@/components/BrandMark';
import { Separator } from '@/components/ui/separator';

export function LandingFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 pb-12">
      <Separator />
      <div className="text-content-500 flex flex-col items-center justify-between gap-4 pt-8 text-sm sm:flex-row">
        <p className="flex items-center gap-2">
          <BrandMark size="sm" />
          NestCord — built by hand, in the evenings, to learn how it all fits together.
        </p>

        <nav aria-label="Footer" className="flex items-center gap-6">
          <Link to="/login" className="hover:text-content-100 transition-colors">
            Log in
          </Link>
          <a
            href="https://github.com/Elliot200504/NestCord"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-content-100 transition-colors"
          >
            Source
          </a>
        </nav>
      </div>
    </footer>
  );
}
