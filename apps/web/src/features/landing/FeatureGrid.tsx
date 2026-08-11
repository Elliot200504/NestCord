import { features } from './landing-content';

export function FeatureGrid() {
  return (
    <section aria-labelledby="features-heading" className="mx-auto w-full max-w-5xl px-6 py-20">
      <div className="max-w-2xl">
        <h2
          id="features-heading"
          className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Everything a small community needs
        </h2>
        <p className="text-content-300 mt-4 text-pretty">
          Built for a few hundred people who know each other — not for a million strangers.
        </p>
      </div>

      {/* Hairlines, not boxes. Six identical cards is what a template looks like. */}
      <ul className="border-border mt-12 grid gap-x-12 border-t sm:grid-cols-2">
        {features.map((feature) => (
          <li key={feature.title} className="border-border flex gap-4 border-b py-7">
            <span
              aria-hidden
              className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-full"
            >
              <feature.icon className="size-4.5" />
            </span>
            <div>
              <h3 className="font-display text-base font-semibold">{feature.title}</h3>
              <p className="text-content-300 mt-1.5 text-sm text-pretty">{feature.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
