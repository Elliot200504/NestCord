import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it } from 'vitest';

import { FakePrisma } from '../common/testing/fake-prisma';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthService } from './auth.service';

const ENV: Record<string, string> = {
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
};

const CREDENTIALS = { username: 'ada', email: 'ada@nestcord.local', password: 'password123' };

async function buildService(): Promise<{ auth: AuthService; prisma: FakePrisma }> {
  const prisma = new FakePrisma();

  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      JwtService,
      { provide: PrismaService, useValue: prisma.asPrismaService() },
      { provide: ConfigService, useValue: { get: (key: string) => ENV[key] } },
    ],
  }).compile();

  return { auth: moduleRef.get(AuthService), prisma };
}

describe('AuthService', () => {
  let auth: AuthService;
  let prisma: FakePrisma;

  beforeEach(async () => {
    ({ auth, prisma } = await buildService());
  });

  describe('register', () => {
    it('stores an argon2id hash and never the plaintext password', async () => {
      await auth.register(CREDENTIALS);

      const user = [...prisma.users.values()][0];
      expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user?.passwordHash).not.toContain(CREDENTIALS.password);
    });

    it('returns an access token and the new user, without the password hash', async () => {
      const issued = await auth.register(CREDENTIALS);

      expect(issued.session.accessToken).toBeTruthy();
      expect(issued.session.user).toEqual({
        id: expect.any(String),
        username: 'ada',
        avatarUrl: null,
        status: 'OFFLINE',
      });
    });

    it('rejects a duplicate email', async () => {
      await auth.register(CREDENTIALS);

      await expect(auth.register({ ...CREDENTIALS, username: 'ada2' })).rejects.toMatchObject({
        status: 409,
      });
    });

    it('rejects a duplicate username', async () => {
      await auth.register(CREDENTIALS);

      await expect(
        auth.register({ ...CREDENTIALS, email: 'other@nestcord.local' }),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('login', () => {
    it('issues a session for the right password', async () => {
      await auth.register(CREDENTIALS);

      const issued = await auth.login({
        email: CREDENTIALS.email,
        password: CREDENTIALS.password,
      });

      expect(issued.session.user.username).toBe('ada');
    });

    it('rejects a wrong password', async () => {
      await auth.register(CREDENTIALS);

      await expect(
        auth.login({ email: CREDENTIALS.email, password: 'not-the-password' }),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('rejects an unknown email with the same message as a wrong password', async () => {
      await expect(
        auth.login({ email: 'nobody@nestcord.local', password: CREDENTIALS.password }),
      ).rejects.toMatchObject({ status: 401, message: 'Incorrect email or password' });
    });
  });

  describe('refresh', () => {
    it('rotates the stored hash so the old token stops working', async () => {
      const first = await auth.register(CREDENTIALS);
      const hashBefore = [...prisma.sessions.values()][0]?.refreshTokenHash;

      const second = await auth.refresh(first.refreshToken);

      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect([...prisma.sessions.values()][0]?.refreshTokenHash).not.toBe(hashBefore);
    });

    it('keeps the same session row across a rotation', async () => {
      const first = await auth.register(CREDENTIALS);
      const second = await auth.refresh(first.refreshToken);

      expect(second.refreshToken.split('.')[0]).toBe(first.refreshToken.split('.')[0]);
      expect(prisma.sessions.size).toBe(1);
    });

    it('revokes the session when a replayed old token is presented', async () => {
      const first = await auth.register(CREDENTIALS);
      await auth.refresh(first.refreshToken);

      await expect(auth.refresh(first.refreshToken)).rejects.toMatchObject({ status: 401 });
      expect(prisma.sessions.size).toBe(0);
    });

    it('rejects and deletes an expired session', async () => {
      const issued = await auth.register(CREDENTIALS);
      const session = [...prisma.sessions.values()][0];
      if (session) prisma.sessions.set(session.id, { ...session, expiresAt: new Date(0) });

      await expect(auth.refresh(issued.refreshToken)).rejects.toMatchObject({ status: 401 });
      expect(prisma.sessions.size).toBe(0);
    });

    it('rejects a missing cookie', async () => {
      await expect(auth.refresh(undefined)).rejects.toMatchObject({ status: 401 });
    });

    it('rejects a token whose session never existed', async () => {
      await expect(auth.refresh('session-999.whatever')).rejects.toMatchObject({ status: 401 });
    });
  });

  describe('logout', () => {
    it('deletes the session row so the refresh token is dead server-side', async () => {
      const issued = await auth.register(CREDENTIALS);

      await auth.logout(issued.refreshToken);

      expect(prisma.sessions.size).toBe(0);
      await expect(auth.refresh(issued.refreshToken)).rejects.toMatchObject({ status: 401 });
    });

    it('is a no-op without a cookie', async () => {
      await expect(auth.logout(undefined)).resolves.toBeUndefined();
    });
  });

  describe('findSessionUser', () => {
    it('rejects an access token whose session was logged out', async () => {
      const issued = await auth.register(CREDENTIALS);
      const sessionId = issued.refreshToken.split('.')[0] ?? '';
      await auth.logout(issued.refreshToken);

      await expect(
        auth.findSessionUser({ sub: issued.session.user.id, sid: sessionId }),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('rejects a token whose user id does not match the session', async () => {
      const issued = await auth.register(CREDENTIALS);
      const sessionId = issued.refreshToken.split('.')[0] ?? '';

      await expect(
        auth.findSessionUser({ sub: 'someone-else', sid: sessionId }),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('returns the user for a live session', async () => {
      const issued = await auth.register(CREDENTIALS);
      const sessionId = issued.refreshToken.split('.')[0] ?? '';

      await expect(
        auth.findSessionUser({ sub: issued.session.user.id, sid: sessionId }),
      ).resolves.toEqual(issued.session.user);
    });
  });

  it('signs an access token carrying the user and session id and nothing sensitive', async () => {
    const issued = await auth.register(CREDENTIALS);
    const payload = new JwtService().decode(issued.session.accessToken) as Record<string, unknown>;

    expect(payload.sub).toBe(issued.session.user.id);
    expect(payload.sid).toBe(issued.refreshToken.split('.')[0]);
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sid', 'sub']);
  });

  it('produces a verifiable hash for the refresh secret rather than storing it raw', async () => {
    const issued = await auth.register(CREDENTIALS);
    const [, secret = ''] = issued.refreshToken.split('.');
    const stored = [...prisma.sessions.values()][0]?.refreshTokenHash ?? '';

    expect(stored).not.toContain(secret);
    await expect(argon2.verify(stored, secret)).resolves.toBe(true);
  });
});
