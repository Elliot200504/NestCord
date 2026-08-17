import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

/**
 * `pnpm test` runs the API, web and shared suites at once, and a shell test waits on
 * a chain of stubbed fetches. On a loaded machine that chain can outlast Testing
 * Library's 1s default and fail a test that is perfectly correct.
 */
configure({ asyncUtilTimeout: 5000 });

/**
 * jsdom has no `matchMedia`, and the app shell reads it to decide whether its side
 * panels are columns or drawers.
 *
 * The stub reports every query as matching, so components under test get the wide
 * layout by default — that is the one where every panel is on screen and therefore
 * queryable. A test about narrow behaviour overrides this itself.
 */
export function stubMatchMedia(matches: boolean): void {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

stubMatchMedia(true);
