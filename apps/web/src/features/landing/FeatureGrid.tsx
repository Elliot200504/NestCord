import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { features } from './landing-content';

export function FeatureGrid() {
  return (
    <section aria-labelledby="features-heading" className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="features-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
          Everything a small community needs
        </h2>
        <p className="text-muted-foreground mt-4 text-pretty">
          Built for a few hundred people who know each other — not for a million strangers.
        </p>
      </div>

      <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <li key={feature.title}>
            <Card className="hover:border-primary/40 h-full transition-colors">
              <CardHeader>
                <span
                  aria-hidden
                  className="bg-primary/10 text-primary mb-3 grid size-10 place-items-center rounded-lg"
                >
                  <feature.icon className="size-5" />
                </span>
                <CardTitle className="text-base">{feature.title}</CardTitle>
                <CardDescription className="text-pretty">{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
