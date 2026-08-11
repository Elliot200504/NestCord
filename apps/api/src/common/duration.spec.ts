import { describe, expect, it } from 'vitest';

import { durationToMs } from './duration';

describe('durationToMs', () => {
  it('converts each supported unit', () => {
    expect(durationToMs('30s')).toBe(30_000);
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('2h')).toBe(7_200_000);
    expect(durationToMs('30d')).toBe(2_592_000_000);
  });

  it('reads a bare number as seconds, the way JWT does', () => {
    expect(durationToMs('60')).toBe(60_000);
  });

  it('rejects a malformed duration instead of guessing', () => {
    expect(() => durationToMs('15 minutes')).toThrow(/Invalid duration/);
    expect(() => durationToMs('')).toThrow(/Invalid duration/);
  });
});
