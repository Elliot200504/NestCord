import { useAppearanceStore, type Density, type Theme } from '@/stores/appearance-store';
import { ChoiceGroup, SettingsSection } from './SettingsPrimitives';

/** Miniatures of the real thing — a swatch says more than the word "dark". */
const THEMES: ReadonlyArray<{ value: Theme; label: string; preview: React.ReactNode }> = [
  {
    value: 'dark',
    label: 'Dark',
    preview: <ThemeSwatch background="#0c0908" foreground="#f6f1ef" />,
  },
  {
    value: 'light',
    label: 'Light',
    preview: <ThemeSwatch background="#fbf7f4" foreground="#0c0908" />,
  },
  {
    value: 'system',
    label: 'Sync with system',
    preview: <ThemeSwatch background="#0c0908" foreground="#f6f1ef" split />,
  },
];

const DENSITIES: ReadonlyArray<{ value: Density; label: string; preview: React.ReactNode }> = [
  { value: 'comfortable', label: 'Comfortable', preview: <DensitySwatch gap={7} /> },
  { value: 'compact', label: 'Compact', preview: <DensitySwatch gap={3} /> },
];

export function AppearanceSection() {
  const { theme, density, setTheme, setDensity } = useAppearanceStore();

  return (
    <>
      <SettingsSection
        title="Appearance"
        description="Kept in this browser only — it is a preference, not part of your account."
      >
        <ChoiceGroup label="Theme" value={theme} options={THEMES} onChange={setTheme} />
      </SettingsSection>

      <SettingsSection title="Message density" description="How much room each message gets.">
        <ChoiceGroup label="Density" value={density} options={DENSITIES} onChange={setDensity} />
      </SettingsSection>
    </>
  );
}

function ThemeSwatch({
  background,
  foreground,
  split,
}: {
  background: string;
  foreground: string;
  split?: boolean;
}) {
  return (
    <span
      aria-hidden
      className="block h-16 overflow-hidden rounded-lg"
      style={{
        background: split ? `linear-gradient(105deg, ${background} 50%, #fbf7f4 50%)` : background,
      }}
    >
      <span className="flex h-full flex-col justify-center gap-1.5 px-3">
        {[70, 45, 60].map((width, index) => (
          <span
            key={width}
            className="block h-1.5 rounded-full"
            style={{
              width: `${width}%`,
              background: foreground,
              opacity: index === 0 ? 0.75 : 0.35,
            }}
          />
        ))}
      </span>
    </span>
  );
}

function DensitySwatch({ gap }: { gap: number }) {
  return (
    <span
      aria-hidden
      className="bg-surface-900 flex h-16 flex-col justify-center rounded-lg px-3"
      style={{ gap: `${gap}px` }}
    >
      {[80, 55, 70].map((width) => (
        <span
          key={width}
          className="bg-content-500 block h-1.5 rounded-full"
          style={{ width: `${width}%` }}
        />
      ))}
    </span>
  );
}
