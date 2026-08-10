import { createRoute } from '@tanstack/react-router';

import { FeatureGrid } from '@/features/landing/FeatureGrid';
import { LandingCta } from '@/features/landing/LandingCta';
import { LandingFooter } from '@/features/landing/LandingFooter';
import { LandingHero } from '@/features/landing/LandingHero';
import { LandingNav } from '@/features/landing/LandingNav';
import { rootRoute } from './root';

/** The public entry point every visitor lands on. */
function LandingPage() {
  return (
    <div className="bg-background min-h-screen">
      <LandingNav />
      <main>
        <LandingHero />
        <FeatureGrid />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}

export const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
});
