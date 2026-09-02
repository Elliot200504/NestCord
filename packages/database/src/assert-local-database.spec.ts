import { describe, expect, it } from 'vitest';

import { assertLocalDatabase } from './assert-local-database.js';

const LOCAL = 'postgresql://nestcord:nestcord@localhost:5432/nestcord?schema=public';

describe('assertLocalDatabase', () => {
  it('allows a local database', () => {
    expect(() => assertLocalDatabase(LOCAL, 'development')).not.toThrow();
  });

  it.each(['localhost', '127.0.0.1', 'db', 'postgres'])('allows the host %s', (host) => {
    expect(() =>
      assertLocalDatabase(`postgresql://user:pass@${host}:5432/nestcord`, 'development'),
    ).not.toThrow();
  });

  it('refuses to run when NODE_ENV is production, even against localhost', () => {
    expect(() => assertLocalDatabase(LOCAL, 'production')).toThrow(
      'Refusing to seed: NODE_ENV is production.',
    );
  });

  it('refuses a remote host, naming it', () => {
    expect(() =>
      assertLocalDatabase('postgresql://user:pass@db.example.com:5432/nestcord', 'development'),
    ).toThrow('database host "db.example.com" is not local');
  });

  it('says why a remote host is refused, so the message is actionable', () => {
    expect(() =>
      assertLocalDatabase('postgresql://user:pass@10.0.0.5:5432/nestcord', 'development'),
    ).toThrow('publicly known password');
  });

  it('refuses an empty DATABASE_URL', () => {
    expect(() => assertLocalDatabase('', 'development')).toThrow(
      'DATABASE_URL is missing or not a valid URL',
    );
  });

  it('refuses a DATABASE_URL that is not a URL at all', () => {
    expect(() => assertLocalDatabase('not a url', 'development')).toThrow(
      'DATABASE_URL is missing or not a valid URL',
    );
  });

  it('is not fooled by a local host appearing elsewhere in the url', () => {
    // The credentials and the database name both say localhost; the host does not.
    expect(() =>
      assertLocalDatabase('postgresql://localhost:localhost@evil.example:5432/localhost', 'test'),
    ).toThrow('is not local');
  });
});
