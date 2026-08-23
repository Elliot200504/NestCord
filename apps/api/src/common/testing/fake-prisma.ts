import type { PresenceStatus } from '@nestcord/shared';

import type { PrismaService } from '../prisma/prisma.service';

/**
 * A tiny in-memory stand-in for the handful of Prisma calls the auth code makes.
 *
 * The project rule is to test queries against real PostgreSQL — this is not that.
 * It exists so the *auth rules* (hashing, rotation, revocation, guard behaviour)
 * can be tested without a database. Query correctness is covered by running the
 * app against PostgreSQL, not here.
 */

export interface FakeUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  bio: string | null;
  accentColor: string | null;
  avatarUrl: string | null;
  status: PresenceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}

/** A string column compared either exactly or without regard to case. */
type StringFilter = string | { equals: string; mode?: 'insensitive' };

/** The `where` shapes the auth code asks for, and nothing else. */
interface UserWhere {
  OR?: UserWhere[];
  email?: StringFilter;
  username?: StringFilter;
  id?: { not: string };
}

function matchesString(value: string, filter: StringFilter | undefined): boolean {
  if (filter === undefined) return true;
  if (typeof filter === 'string') return value === filter;

  return filter.mode === 'insensitive'
    ? value.toLowerCase() === filter.equals.toLowerCase()
    : value === filter.equals;
}

/**
 * Mirrors how PostgreSQL answers these clauses — in particular that a plain string
 * comparison is case-*sensitive*, which is the whole reason the email rules need
 * testing at all.
 */
function matchesWhere(user: FakeUser, where: UserWhere): boolean {
  if (where.OR) return where.OR.some((clause) => matchesWhere(user, clause));

  return (
    matchesString(user.email, where.email) &&
    matchesString(user.username, where.username) &&
    (where.id === undefined || user.id !== where.id.not)
  );
}

export class FakePrisma {
  readonly users = new Map<string, FakeUser>();
  readonly sessions = new Map<string, FakeSession>();

  private nextId = 1;

  readonly client = {
    user: {
      findFirst: async ({ where }: { where: UserWhere }) =>
        [...this.users.values()].find((user) => matchesWhere(user, where)) ?? null,

      findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return this.users.get(where.id) ?? null;
        return [...this.users.values()].find((user) => user.email === where.email) ?? null;
      },

      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
        const user = this.users.get(where.id);
        if (!user) throw new Error(`No user ${where.id}`);

        const next: FakeUser = { ...user, ...data, updatedAt: new Date() };
        this.users.set(next.id, next);
        return next;
      },

      create: async ({
        data,
      }: {
        data: { username: string; email: string; passwordHash: string };
      }) => {
        const user: FakeUser = {
          id: this.id('user'),
          username: data.username,
          email: data.email,
          passwordHash: data.passwordHash,
          displayName: null,
          bio: null,
          accentColor: null,
          avatarUrl: null,
          status: 'OFFLINE',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        this.users.set(user.id, user);
        return user;
      },
    },

    session: {
      create: async ({
        data,
      }: {
        data: {
          userId: string;
          refreshTokenHash: string;
          expiresAt: Date;
          userAgent: string | null;
        };
      }) => {
        const session: FakeSession = {
          id: this.id('session'),
          userId: data.userId,
          refreshTokenHash: data.refreshTokenHash,
          userAgent: data.userAgent,
          createdAt: new Date(),
          expiresAt: data.expiresAt,
        };

        this.sessions.set(session.id, session);
        return session;
      },

      findUnique: async ({ where }: { where: { id: string } }) => {
        const session = this.sessions.get(where.id);
        if (!session) return null;

        const user = this.users.get(session.userId);
        if (!user) return null;

        // Both `include: { user: true }` call sites want the user attached.
        return { ...session, user };
      },

      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { refreshTokenHash: string; expiresAt: Date; userAgent: string | null };
      }) => {
        const session = this.sessions.get(where.id);
        if (!session) throw new Error(`No session ${where.id}`);

        const next: FakeSession = { ...session, ...data };
        this.sessions.set(next.id, next);
        return next;
      },

      findMany: async ({ where }: { where: { userId: string; expiresAt?: { gt: Date } } }) =>
        [...this.sessions.values()]
          .filter((session) => session.userId === where.userId)
          .filter((session) => !where.expiresAt || session.expiresAt > where.expiresAt.gt)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),

      deleteMany: async ({
        where,
      }: {
        where: { id?: string | { not: string }; userId?: string };
      }) => {
        const doomed = [...this.sessions.values()].filter((session) => {
          if (where.userId && session.userId !== where.userId) return false;
          if (typeof where.id === 'string') return session.id === where.id;
          if (where.id) return session.id !== where.id.not;

          return true;
        });

        doomed.forEach((session) => this.sessions.delete(session.id));
        return { count: doomed.length };
      },
    },
  };

  private id(prefix: string): string {
    return `${prefix}-${this.nextId++}`;
  }

  /** Hands the fake to Nest wherever a PrismaService is expected. */
  asPrismaService(): PrismaService {
    return this as unknown as PrismaService;
  }
}
