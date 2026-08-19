import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
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

/**
 * HTTP-level checks for the auth routes: status codes, the refresh cookie, and
 * that the global guard actually guards. The rate limiter is left out of the
 * module so these tests are not competing with its counters.
 */
describe('Auth routes', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ENV] }),
        PrismaModule,
        AuthModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    })
      .overrideProvider(PrismaService)
      .useValue(new FakePrisma().asPrismaService())
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  /** Pulls the refresh cookie out of a Set-Cookie header. */
  function refreshCookie(headers: Record<string, unknown>): string {
    const raw = headers['set-cookie'];
    const values = Array.isArray(raw) ? (raw as string[]) : [];
    return values.find((value) => value.startsWith(`${REFRESH_COOKIE}=`)) ?? '';
  }

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

  it('registers a user and sets an httpOnly refresh cookie scoped to the auth routes', async () => {
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
    expect(response.body.user).toEqual({
      id: expect.any(String),
      username: 'ada',
      displayName: null,
      avatarUrl: null,
      accentColor: null,
      status: 'OFFLINE',
    });
  });

  it('rejects a registration that fails validation, listing the offending field', async () => {
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

  it('rejects a login with the wrong password', async () => {
    await register();

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: CREDENTIALS.email, password: 'wrong-password' })
      .expect(401);
  });

  it('refuses /auth/me without a token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('refuses /auth/me with a forged token', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.jwt')
      .expect(401);
  });

  it('answers /auth/me for a valid access token', async () => {
    const { accessToken } = await register();

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.username).toBe('ada');
  });

  it('issues a fresh access token and a new cookie on refresh', async () => {
    const { cookie } = await register();

    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.accessToken).toBeTruthy();
    expect(refreshCookie(response.headers)).not.toBe(cookie);
  });

  it('rejects a refresh with no cookie and clears whatever was there', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);

    expect(refreshCookie(response.headers)).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('stops the access token working once the session is logged out', async () => {
    const { accessToken, cookie } = await register();

    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(204);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});
