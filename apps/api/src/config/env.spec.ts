import { describe, expect, it } from 'vitest';

import { validateEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://nestcord:nestcord@localhost:5432/nestcord',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv({ ...valid });

    expect(env.API_PORT).toBe(3000);
    expect(env.WEB_URL).toBe('http://localhost:5173');
    expect(env.NODE_ENV).toBe('development');
  });

  it('coerces numeric variables from strings', () => {
    const env = validateEnv({ ...valid, API_PORT: '4000' });

    expect(env.API_PORT).toBe(4000);
  });

  it('rejects a short JWT secret rather than booting insecurely', () => {
    expect(() => validateEnv({ ...valid, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('rejects a missing database url', () => {
    const { DATABASE_URL: _omitted, ...withoutDatabase } = valid;

    expect(() => validateEnv(withoutDatabase)).toThrow(/DATABASE_URL/);
  });
});
