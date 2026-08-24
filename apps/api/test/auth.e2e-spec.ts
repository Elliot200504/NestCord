import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthModule } from '../src/auth/auth.module';
import { REFRESH_COOKIE } from '../src/auth/auth.controller';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaModule } from '../src/common/prisma/prisma.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FakePrisma } from '../src/common/testing/fake-prisma';

const ENV = {
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
};

const CREDENTIALS = { username: 'ada', email: 'ada@nestcord.local', password: 'password123' };

/** The whole of what /auth/me is allowed to say about the signed-in account. */
const PUBLIC_ADA = {
  id: expect.any(String),
  username: 'ada',
  displayName: null,
  avatarUrl: null,
  accentColor: null,
  status: 'OFFLINE',
};

/** Boots the auth routes over a fake Prisma, wired the way main.ts wires them. */
async function createApp(env: Record<string, string> = ENV): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => env] }),
      PrismaModule,
      AuthModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
  })
    .overrideProvider(PrismaService)
    .useValue(new FakePrisma().asPrismaService())
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  await app.init();

  return app;
}

/** Pulls the refresh cookie out of a Set-Cookie header. */
function refreshCookie(headers: Record<string, unknown>): string {
  const raw = headers['set-cookie'];
  const values = Array.isArray(raw) ? (raw as string[]) : [];
  return values.find((value) => value.startsWith(`${REFRESH_COOKIE}=`)) ?? '';
}

/**
 * Re-signs the claims of a real access token with different options.
 *
 * Reusing the live `sub` and `sid` matters: an invented payload would be refused
 * for naming a session that does not exist, which would prove nothing about the
 * signature or the expiry the caller is actually testing.
 */
async function resign(
  accessToken: string,
  options: { secret: string; expiresIn?: string },
): Promise<string> {
  const jwt = new JwtService();
  const { sub, sid } = jwt.decode(accessToken) as { sub: string; sid: string };

  return jwt.signAsync({ sub, sid }, options);
}

/**
 * HTTP-level checks for the auth routes: status codes, the refresh cookie, and
 * that the global guard actually guards. The rate limiter is left out of the
 * module so these tests are not competing with its counters. The rules behind
 * these routes (hashing, rotation, revocation) are covered in auth.service.spec.
 */
describe('Auth routes', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  async function register() {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(CREDENTIALS)
      .expect(201);

    return {
      accessToken: response.body.accessToken as string,
      cookie: refreshCookie(response.headers),
    };
  }

  async function login() {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: CREDENTIALS.email, password: CREDENTIALS.password })
      .expect(200);

    return {
      accessToken: response.body.accessToken as string,
      cookie: refreshCookie(response.headers),
    };
  }

  describe('POST /auth/register', () => {
    it('creates an account and sets an httpOnly refresh cookie scoped to the auth routes', async () => {
      const { accessToken, cookie } = await register();

      expect(accessToken).toBeTruthy();
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/api/auth');
    });

    it('never returns the password hash or the email of the account it created', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(CREDENTIALS)
        .expect(201);

      expect(JSON.stringify(response.body)).not.toContain('argon2');
      expect(response.body.user).toEqual(PUBLIC_ADA);
    });

    it('rejects a body that fails validation, listing the offending field', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ username: 'a', email: 'not-an-email', password: 'short' })
        .expect(400);

      expect(response.body.message.join(' ')).toMatch(/username|email|password/);
    });

    it('rejects unknown fields in the body rather than ignoring them', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...CREDENTIALS, isAdmin: true })
        .expect(400);
    });

    it('answers a taken email and a taken username with the same 409', async () => {
      await register();

      const takenEmail = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...CREDENTIALS, username: 'ada.lovelace' })
        .expect(409);

      const takenUsername = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...CREDENTIALS, email: 'ada@example.com' })
        .expect(409);

      // Two different clashes, one answer: a precise message would let anyone
      // check whether an email already has an account here.
      expect(takenEmail.body.message).toBe(takenUsername.body.message);
    });
  });

  describe('POST /auth/login', () => {
    it('accepts the right password and starts a second session', async () => {
      const first = await register();
      const second = await login();

      expect(second.accessToken).toBeTruthy();
      expect(second.cookie).toContain('HttpOnly');
      expect(second.cookie).not.toBe(first.cookie);
    });

    it('rejects the wrong password', async () => {
      await register();

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: CREDENTIALS.email, password: 'wrong-password' })
        .expect(401);
    });

    it('rejects an email that has no account, with no cookie attached', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@nestcord.local', password: CREDENTIALS.password })
        .expect(401);

      expect(refreshCookie(response.headers)).toBe('');
    });

    it('rejects a body that is missing the password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: CREDENTIALS.email })
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('answers for a valid access token', async () => {
      const { accessToken } = await register();

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.username).toBe('ada');
    });

    it('keeps the session id and the email out of the response', async () => {
      const { accessToken } = await register();

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual(PUBLIC_ADA);
    });

    it('refuses a request with no token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('refuses a token that is not a JWT at all', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not.a.jwt')
        .expect(401);
    });

    it('refuses a well-formed token signed with the wrong secret', async () => {
      const { accessToken } = await register();
      const forged = await resign(accessToken, { secret: 'b'.repeat(48) });

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('refuses an access token that has expired', async () => {
      const { accessToken } = await register();
      const stale = await resign(accessToken, {
        secret: ENV.JWT_ACCESS_SECRET,
        expiresIn: '-1s',
      });

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${stale}`)
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a fresh access token and a new cookie', async () => {
      const { cookie } = await register();

      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie)
        .expect(200);

      expect(response.body.accessToken).toBeTruthy();
      expect(refreshCookie(response.headers)).not.toBe(cookie);
    });

    it('returns an access token that works on a guarded route', async () => {
      const { cookie } = await register();

      const refreshed = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
        .expect(200);
    });

    it('rejects a request with no cookie and clears whatever was there', async () => {
      const response = await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);

      expect(refreshCookie(response.headers)).toContain('Expires=Thu, 01 Jan 1970');
    });

    it('rejects a cookie whose session never existed', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE}=session-404.some-secret`)
        .expect(401);
    });

    it('revokes the whole session when an already-rotated cookie comes back', async () => {
      const { cookie } = await register();

      const rotated = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie)
        .expect(200);

      // The replay is refused...
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);

      // ...and takes the legitimate cookie down with it: a replay means the
      // session is compromised, so the thief and the victim both start over.
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie(rotated.headers))
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('stops the access token working once the session is gone', async () => {
      const { accessToken, cookie } = await register();

      await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(204);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });

    it('signs out only the device that asked, leaving other sessions alone', async () => {
      const first = await register();
      const second = await login();

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', first.cookie)
        .expect(204);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${first.accessToken}`)
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${second.accessToken}`)
        .expect(200);
    });

    it('treats a request with no cookie as already done', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
    });
  });
});

/** The one cookie attribute that depends on the environment rather than the code path. */
describe('Auth routes in production', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp({ ...ENV, NODE_ENV: 'production' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('marks the refresh cookie Secure', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(CREDENTIALS)
      .expect(201);

    expect(refreshCookie(response.headers)).toContain('Secure');
  });
});
