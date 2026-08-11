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

export class FakePrisma {
  readonly users = new Map<string, FakeUser>();
  readonly sessions = new Map<string, FakeSession>();

  private nextId = 1;

  readonly client = {
    user: {
      findFirst: async ({
        where,
      }: {
        where: { OR?: Array<Record<string, string>>; username?: string; id?: { not: string } };
      }) => {
        const matchesOr = (user: FakeUser) =>
          (where.OR ?? []).some((clause) =>
            Object.entries(clause).every(
              ([field, value]) => user[field as keyof FakeUser] === value,
            ),
          );

        // The two shapes the code actually asks for: "is this taken by anyone"
        // and "is this taken by anyone other than me".
        const matches = (user: FakeUser) =>
          where.OR
            ? matchesOr(user)
            : user.username === where.username && user.id !== where.id?.not;

        return [...this.users.values()].find(matches) ?? null;
      },

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
        data: { userId: string; refreshTokenHash: string; expiresAt: Date; userAgent: string | null };
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
