import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** `system` follows the OS; the other two override it. */
export type Theme = 'dark' | 'light' | 'system';

/** How much air the message list gives each message. */
export type Density = 'comfortable' | 'compact';

interface AppearanceState {
  theme: Theme;
  density: Density;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
}

const STORAGE_KEY = 'nestcord-appearance';

/**
 * A preference, not server state — it belongs in Zustand and in this browser
 * only (PLAN.MD §13). Persisted so the app does not flash a different skin on
 * every reload.
 */
export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: 'dark',
      density: 'comfortable',
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
    }),
    { name: STORAGE_KEY },
  ),
);

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function resolve(theme: Theme): 'dark' | 'light' {
  if (theme !== 'system') return theme;

  return darkQuery().matches ? 'dark' : 'light';
}

/** Tailwind's dark variant keys off this class, so one element decides the skin. */
function apply(theme: Theme): void {
  document.documentElement.classList.toggle('dark', resolve(theme) === 'dark');
}

/**
 * Called once at startup. Subscribing here rather than in a component means the
 * theme is right before the first paint, with no flash of the wrong one.
 */
export function startAppearanceSync(): void {
  apply(useAppearanceStore.getState().theme);

  useAppearanceStore.subscribe((state) => apply(state.theme));

  // Following the OS only matters while `system` is selected.
  darkQuery().addEventListener('change', () => {
    const { theme } = useAppearanceStore.getState();
    if (theme === 'system') apply(theme);
  });
}
