import { randomBytes } from 'node:crypto';

import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { User } from '@nestcord/database';
import type { AuthSession, PublicUser } from '@nestcord/shared';

import { durationToMs } from '../common/duration';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './password';
import { PUBLIC_USER_SELECT, toPublicUser } from './public-user';

/** Everything the caller needs after a successful auth: the body plus the cookie value. */
export interface IssuedSession {
  session: AuthSession;
  refreshToken: string;
  refreshTokenMaxAge: number;
}

export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  /** Session id, so logging out one device invalidates only that device. */
  sid: string;
}

/**
 * What the guard attaches to the request: the public user plus the session the
 * token came from, which routes need in order to talk about "this device".
 */
export interface RequestUser extends PublicUser {
  sessionId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(dto: RegisterDto, userAgent?: string): Promise<IssuedSession> {
    const email = normaliseEmail(dto.email);

    const existing = await this.prisma.client.user.findFirst({
      where: { OR: [{ email: emailFilter(email) }, { username: dto.username }] },
      select: { email: true },
    });

    if (existing) {
      // One message for both cases: registration is public, so a precise error
      // would let anyone check whether an email has an account.
      throw new ConflictException('That username or email is already taken');
    }

    const user = await this.prisma.client.user.create({
      data: {
        username: dto.username,
        email,
        passwordHash: await hashPassword(dto.password),
      },
    });

    return this.issueSession(user, userAgent);
  }

  async login(dto: LoginDto, userAgent?: string): Promise<IssuedSession> {
    const user = await this.prisma.client.user.findFirst({
      where: { email: emailFilter(normaliseEmail(dto.email)) },
    });

    // Hash a throwaway value when the user does not exist so that a missing
    // account and a wrong password take roughly the same time to answer.
    if (!user) {
      await hashPassword(dto.password);
      throw new UnauthorizedException('Incorrect email or password');
    }

    if (!(await verifyPassword(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    return this.issueSession(user, userAgent);
  }

  /**
   * Rotates a refresh token. The cookie carries `sessionId.secret`, so the row can
   * be found by id and the secret compared against its stored hash.
   */
  async refresh(cookieValue: string | undefined, userAgent?: string): Promise<IssuedSession> {
    const { sessionId, secret } = parseRefreshToken(cookieValue);

    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session) throw new UnauthorizedException('Session is no longer valid');

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.deleteSession(sessionId);
      throw new UnauthorizedException('Session has expired');
    }

    if (!(await verifyPassword(session.refreshTokenHash, secret))) {
      // The session id was real but the secret was not: either a stolen cookie or
      // a replayed old token. Either way the session cannot be trusted any more.
      this.logger.warn(`Refresh token mismatch for session ${sessionId} — revoking it`);
      await this.deleteSession(sessionId);
      throw new UnauthorizedException('Session is no longer valid');
    }

    const secretNext = randomBytes(32).toString('base64url');
    const maxAge = this.refreshTtlMs();

    await this.prisma.client.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: await hashPassword(secretNext),
        expiresAt: new Date(Date.now() + maxAge),
        userAgent: userAgent ?? session.userAgent,
      },
    });

    return {
      session: {
        accessToken: await this.signAccessToken(session.user.id, sessionId),
        user: toPublicUser(session.user),
      },
      refreshToken: `${sessionId}.${secretNext}`,
      refreshTokenMaxAge: maxAge,
    };
  }

  /** Logging out deletes the session row, so the refresh token dies server-side too. */
  async logout(cookieValue: string | undefined): Promise<void> {
    if (!cookieValue) return;

    const [sessionId] = cookieValue.split('.');
    if (sessionId) await this.deleteSession(sessionId);
  }

  async findPublicUser(userId: string): Promise<PublicUser> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
    });

    if (!user) throw new UnauthorizedException('Account no longer exists');

    return toPublicUser(user);
  }

  /**
   * Called by the guard on every authenticated request: the JWT alone is not
   * enough, the session row must still exist or logout would not take effect.
   */
  async findSessionUser(payload: AccessTokenPayload): Promise<RequestUser> {
    const session = await this.prisma.client.session.findUnique({
      where: { id: payload.sid },
      select: { expiresAt: true, user: { select: PUBLIC_USER_SELECT } },
    });

    if (!session || session.user.id !== payload.sub) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session has expired');
    }

    return { ...toPublicUser(session.user), sessionId: payload.sid };
  }

  private async issueSession(user: User, userAgent?: string): Promise<IssuedSession> {
    const secret = randomBytes(32).toString('base64url');
    const maxAge = this.refreshTtlMs();

    const session = await this.prisma.client.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: await hashPassword(secret),
        expiresAt: new Date(Date.now() + maxAge),
        userAgent: userAgent ?? null,
      },
      select: { id: true },
    });

    return {
      session: {
        accessToken: await this.signAccessToken(user.id, session.id),
        user: toPublicUser(user),
      },
      refreshToken: `${session.id}.${secret}`,
      refreshTokenMaxAge: maxAge,
    };
  }

  /**
   * Authenticates a raw access token, for the socket handshake.
   *
   * HTTP gets this from the Passport strategy, which only reads an `Authorization`
   * header; a websocket carries its token in the handshake instead. Both end at
   * `findSessionUser`, so a logged-out token is refused on either path.
   */
  async authenticateAccessToken(token: string | undefined): Promise<RequestUser> {
    if (!token) throw new UnauthorizedException('Missing access token');

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });

      return await this.findSessionUser(payload);
    } catch (error) {
      // A malformed or expired token and a revoked session are the same answer to
      // the client: reconnect with a fresh token.
      if (error instanceof UnauthorizedException) throw error;

      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async signAccessToken(userId: string, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId };

    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    });
  }

  private refreshTtlMs(): number {
    return durationToMs(this.config.get('JWT_REFRESH_TTL', { infer: true }));
  }

  /** Deleting an already-deleted session is not an error worth surfacing. */
  private async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.client.session.deleteMany({ where: { id: sessionId } });
  }
}

function parseRefreshToken(value: string | undefined): { sessionId: string; secret: string } {
  const [sessionId, secret] = value?.split('.') ?? [];

  if (!sessionId || !secret) throw new UnauthorizedException('Missing refresh token');

  return { sessionId, secret };
}

/**
 * The stored form of an email address.
 *
 * An address is the same address whatever case it is typed in, and the app already
 * depends on that: `AdminService` lowercases what it reads from the database before
 * comparing it against ADMIN_EMAILS. `email` is unique case-*sensitively*, though,
 * so storing one as typed let `Admin@example.com` be registered alongside
 * `admin@example.com` — and the second account then resolved as that admin.
 */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * How an email is looked up: case-insensitively, so rows written before addresses
 * were normalised still sign in, and so a variant cannot slip past the check that
 * says whether one is taken.
 *
 * Not covered by the `email` index, which is fine — a few hundred rows.
 */
function emailFilter(email: string) {
  return { equals: email, mode: 'insensitive' as const };
}
