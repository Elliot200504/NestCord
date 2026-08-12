import { useState, type ReactNode } from 'react';

/**
 * Hidden until clicked, the way a spoiler has to work to be one.
 *
 * Its own file because `markdown.tsx` is a module of functions, and a component
 * sitting alongside them breaks fast refresh for both.
 */
export function Spoiler({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) return <span className="bg-surface-800 rounded px-0.5">{children}</span>;

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      aria-label="Reveal spoiler"
      className="bg-surface-800 hover:bg-surface-700 rounded px-0.5 text-transparent transition-colors select-none"
    >
      {children}
    </button>
  );
}
