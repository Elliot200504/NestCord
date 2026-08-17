import { useCallback, useSyncExternalStore } from 'react';

/**
 * Where the shell stops being three columns and the side panels become drawers.
 *
 * Kept in one place because the panels and the buttons that open them have to agree:
 * a toggle that is visible at a width where the panel is a fixed column would do
 * nothing, which is the bug this constant exists to prevent.
 */
export const SHELL_WIDE = '(min-width: 768px)';

/** Whether the member list can sit beside the messages rather than over them. */
export const SHELL_ROOMY = '(min-width: 1024px)';

/**
 * Whether a media query currently matches, re-rendering when that changes.
 *
 * The layout decision is made in JS rather than only in CSS because the panels are
 * a column in one mode and an overlay in the other — different markup and different
 * behaviour (a backdrop, Escape to close), not just different widths.
 *
 * `matchMedia` is an external store, so it is read through `useSyncExternalStore`
 * rather than mirrored into state by an effect.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);

      list.addEventListener('change', onChange);

      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // No SSR here, but a server snapshot keeps the hook honest: assume the wide
    // layout so the shell never renders as a drawer that cannot be opened.
    () => true,
  );
}
