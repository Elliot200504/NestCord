const UNIT_MS = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

type Unit = keyof typeof UNIT_MS;

/**
 * Turns the `15m` / `30d` strings used for token lifetimes into milliseconds, so
 * the same config value can drive both the JWT `expiresIn` and a database
 * `expiresAt`. Bare numbers are read as seconds, matching how JWT reads them.
 */
export function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid duration "${value}" — expected something like 15m, 24h or 30d`);
  }

  // The default satisfies noUncheckedIndexedAccess; the regex guarantees group 1.
  const [, amount = '0', unit] = match;
  return Number(amount) * (unit ? UNIT_MS[unit as Unit] : UNIT_MS.s);
}
