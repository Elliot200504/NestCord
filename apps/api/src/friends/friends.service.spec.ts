import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { friendshipPair, type FriendshipStatus, type PublicUser } from '@nestcord/shared';

import type { PrismaService } from '../common/prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { FriendshipRow } from './friend-response';
import { FriendsService } from './friends.service';

const ADA = 'user-ada';
const GRACE = 'user-grace';
const LIN = 'user-lin';

function user(id: string, username: string): PublicUser {
  return {
    id,
    username,
    displayName: null,
    avatarUrl: null,
    accentColor: null,
    status: 'ONLINE',
  };
}

const USERS = new Map([
  [ADA, user(ADA, 'ada')],
  [GRACE, user(GRACE, 'grace')],
  [LIN, user(LIN, 'lin')],
]);

/**
 * An in-memory stand-in for the friendship queries this service makes.
 *
 * Query correctness belongs to PostgreSQL; what is worth testing here is the state
 * machine — who may ask, accept, remove and block whom — which is pure rules on top
 * of one row per pair.
 */
class StubPrisma {
  private rows: FriendshipRow[] = [];
  private nextId = 1;

  /** Seeds a row, canonicalised the same way the service stores it. */
  seed(a: string, b: string, status: FriendshipStatus, requestedBy: string): FriendshipRow {
    const { userId, friendId } = friendshipPair(a, b);
    const row: FriendshipRow = {
      id: `friendship-${this.nextId++}`,
      userId,
      friendId,
      status,
      requestedBy,
      createdAt: new Date('2026-08-13T09:00:00.000Z'),
      user: USERS.get(userId)!,
      friend: USERS.get(friendId)!,
    };

    this.rows = [...this.rows, row];

    return row;
  }

  all(): FriendshipRow[] {
    return this.rows;
  }

  readonly client = {
    user: {
      findUnique: async ({ where }: { where: { id?: string; username?: string } }) => {
        if (where.id) return USERS.get(where.id) ?? null;

        return [...USERS.values()].find((user) => user.username === where.username) ?? null;
      },
    },

    friendship: {
      findMany: async ({ where }: { where: { OR: Array<Record<string, string>> } }) =>
        this.rows.filter((row) =>
          where.OR.some((clause) =>
            Object.entries(clause).every(
              ([field, value]) => row[field as 'userId' | 'friendId'] === value,
            ),
          ),
        ),

      findUnique: async ({
        where,
      }: {
        where: { userId_friendId: { userId: string; friendId: string } };
      }) =>
        this.rows.find(
          (row) =>
            row.userId === where.userId_friendId.userId &&
            row.friendId === where.userId_friendId.friendId,
        ) ?? null,

      create: async ({
        data,
      }: {
        data: { userId: string; friendId: string; status: FriendshipStatus; requestedBy: string };
      }) => this.seed(data.userId, data.friendId, data.status, data.requestedBy),

      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { status: FriendshipStatus };
      }) => {
        const next = { ...this.find(where.id), ...data };
        this.rows = this.rows.map((row) => (row.id === where.id ? next : row));

        return next;
      },

      delete: async ({ where }: { where: { id: string } }) => {
        const row = this.find(where.id);
        this.rows = this.rows.filter((candidate) => candidate.id !== where.id);

        return row;
      },

      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { userId_friendId: { userId: string; friendId: string } };
        create: { userId: string; friendId: string; status: FriendshipStatus; requestedBy: string };
        update: { status: FriendshipStatus; requestedBy: string };
      }) => {
        const existing = this.rows.find(
          (row) =>
            row.userId === where.userId_friendId.userId &&
            row.friendId === where.userId_friendId.friendId,
        );

        if (!existing)
          return this.seed(create.userId, create.friendId, create.status, create.requestedBy);

        const next = { ...existing, ...update };
        this.rows = this.rows.map((row) => (row.id === existing.id ? next : row));

        return next;
      },
    },
  };

  private find(id: string): FriendshipRow {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error(`No friendship ${id}`);

    return row;
  }

  asPrismaService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

describe('FriendsService', () => {
  let prisma: StubPrisma;
  let notifications: { notifyFriendRequest: ReturnType<typeof vi.fn> };
  let friends: FriendsService;

  beforeEach(() => {
    prisma = new StubPrisma();
    notifications = { notifyFriendRequest: vi.fn() };
    friends = new FriendsService(
      prisma.asPrismaService(),
      notifications as unknown as NotificationsService,
    );
  });

  describe('list', () => {
    it('resolves each row against the person asking', async () => {
      prisma.seed(ADA, GRACE, 'ACCEPTED', ADA);

      const [forAda] = await friends.list(ADA);
      const [forGrace] = await friends.list(GRACE);

      expect(forAda?.user.username).toBe('grace');
      expect(forGrace?.user.username).toBe('ada');
    });

    it('marks a request you sent as outgoing and one you received as incoming', async () => {
      prisma.seed(ADA, GRACE, 'PENDING', ADA);

      expect((await friends.list(ADA))[0]?.direction).toBe('OUTGOING');
      expect((await friends.list(GRACE))[0]?.direction).toBe('INCOMING');
    });

    it('shows a block to whoever placed it', async () => {
      prisma.seed(ADA, GRACE, 'BLOCKED', ADA);

      expect(await friends.list(ADA)).toHaveLength(1);
    });

    it('hides a block from the person who was blocked', async () => {
      prisma.seed(ADA, GRACE, 'BLOCKED', ADA);

      expect(await friends.list(GRACE)).toEqual([]);
    });
  });

  describe('sendRequest', () => {
    it('records a pending request and tells the recipient', async () => {
      const sent = await friends.sendRequest(ADA, 'grace');

      expect(sent).toMatchObject({ status: 'PENDING', direction: 'OUTGOING' });
      expect(sent.user.username).toBe('grace');
      expect(notifications.notifyFriendRequest).toHaveBeenCalledWith(
        GRACE,
        sent.id,
        expect.objectContaining({ username: 'ada' }),
      );
    });

    /**
     * `username` is unique case-sensitively, so two accounts can differ only by
     * case. Matching loosely would let a request land on whichever of them the
     * database happened to return.
     */
    it('matches the username exactly, case included', async () => {
      await expect(friends.sendRequest(ADA, 'GrAcE')).rejects.toThrow(NotFoundException);
    });

    it('stores the pair in canonical order whichever way round it was sent', async () => {
      await friends.sendRequest(LIN, 'ada');

      expect(prisma.all()[0]).toMatchObject({ userId: ADA, friendId: LIN, requestedBy: LIN });
    });

    it('rejects a name nobody has', async () => {
      await expect(friends.sendRequest(ADA, 'nobody')).rejects.toThrow(NotFoundException);
    });

    it('rejects adding yourself', async () => {
      await expect(friends.sendRequest(ADA, 'ada')).rejects.toThrow(BadRequestException);
    });

    it('rejects a second request to someone you already asked', async () => {
      prisma.seed(ADA, GRACE, 'PENDING', ADA);

      await expect(friends.sendRequest(ADA, 'grace')).rejects.toThrow(ConflictException);
    });

    it('rejects a request to someone who is already a friend', async () => {
      prisma.seed(ADA, GRACE, 'ACCEPTED', ADA);

      await expect(friends.sendRequest(ADA, 'grace')).rejects.toThrow(ConflictException);
    });

    it('accepts the existing request when both people ask at once', async () => {
      prisma.seed(ADA, GRACE, 'PENDING', GRACE);

      const result = await friends.sendRequest(ADA, 'grace');

      expect(result.status).toBe('ACCEPTED');
      expect(prisma.all()).toHaveLength(1);
    });

    it('refuses a request to someone you blocked', async () => {
      prisma.seed(ADA, GRACE, 'BLOCKED', ADA);

      await expect(friends.sendRequest(ADA, 'grace')).rejects.toThrow(ForbiddenException);
    });

    /** The blocked user must not be able to tell a block from a plain refusal. */
    it('refuses a request from someone who blocked you, saying nothing about why', async () => {
      prisma.seed(ADA, GRACE, 'BLOCKED', ADA);

      await expect(friends.sendRequest(GRACE, 'ada')).rejects.toThrow(
        'You cannot send a request to that user',
      );
    });
  });

  describe('accept', () => {
    it('turns an incoming request into a friendship', async () => {
      prisma.seed(ADA, GRACE, 'PENDING', ADA);

      const accepted = await friends.accept(GRACE, ADA);

      expect(accepted.status).toBe('ACCEPTED');
    });

    it('rejects an attempt to accept your own request', async () => {
      prisma.seed(ADA, GRACE, 'PENDING', ADA);

      await expect(friends.accept(ADA, GRACE)).rejects.toThrow(ForbiddenException);
    });

    it('rejects accepting when there is no request', async () => {
      await expect(friends.accept(ADA, GRACE)).rejects.toThrow(NotFoundException);
    });

    it('rejects accepting an existing friendship again', async () => {
      prisma.seed(ADA, GRACE, 'ACCEPTED', ADA);

      await expect(friends.accept(GRACE, ADA)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes a friend', async () => {
      prisma.seed(ADA, GRACE, 'ACCEPTED', ADA);

      await friends.remove(ADA, GRACE);

      expect(prisma.all()).toEqual([]);
    });

    it('withdraws a request you sent', async () => {
      prisma.seed(ADA, GRACE, 'PENDING', ADA);

      await friends.remove(ADA, GRACE);

      expect(prisma.all()).toEqual([]);
    });

    it('rejects a request someone sent you', async () => {
      prisma.seed(ADA, GRACE, 'PENDING', ADA);

      await friends.remove(GRACE, ADA);

      expect(prisma.all()).toEqual([]);
    });

    /** Otherwise being blocked would be trivially escapable. */
    it('will not delete a block someone placed on you', async () => {
      prisma.seed(ADA, GRACE, 'BLOCKED', ADA);

      await expect(friends.remove(GRACE, ADA)).rejects.toThrow(NotFoundException);
      expect(prisma.all()).toHaveLength(1);
    });
  });

  describe('block', () => {
    it('replaces an existing friendship with a block', async () => {
      prisma.seed(ADA, GRACE, 'ACCEPTED', GRACE);

      const blocked = await friends.block(ADA, GRACE);

      expect(blocked.status).toBe('BLOCKED');
      expect(prisma.all()).toHaveLength(1);
      expect(prisma.all()[0]).toMatchObject({ status: 'BLOCKED', requestedBy: ADA });
    });

    it('blocks someone you have no relationship with', async () => {
      const blocked = await friends.block(ADA, LIN);

      expect(blocked).toMatchObject({ status: 'BLOCKED', direction: 'OUTGOING' });
    });

    it('rejects blocking yourself', async () => {
      await expect(friends.block(ADA, ADA)).rejects.toThrow(BadRequestException);
    });

    it('rejects blocking a user who does not exist', async () => {
      await expect(friends.block(ADA, 'user-ghost')).rejects.toThrow(NotFoundException);
    });

    /**
     * Taking ownership of their block would let the blocked person lift it by
     * blocking back and then unblocking.
     */
    it('leaves a block placed by the other person with them', async () => {
      prisma.seed(ADA, GRACE, 'BLOCKED', ADA);

      await friends.block(GRACE, ADA);

      expect(prisma.all()[0]?.requestedBy).toBe(ADA);
    });
  });

  describe('unblock', () => {
    it('lifts a block you placed', async () => {
      prisma.seed(ADA, GRACE, 'BLOCKED', ADA);

      await friends.unblock(ADA, GRACE);

      expect(prisma.all()).toEqual([]);
    });

    it('will not lift a block someone else placed', async () => {
      prisma.seed(ADA, GRACE, 'BLOCKED', ADA);

      await expect(friends.unblock(GRACE, ADA)).rejects.toThrow(NotFoundException);
    });

    it('rejects unblocking someone who is not blocked', async () => {
      prisma.seed(ADA, GRACE, 'ACCEPTED', ADA);

      await expect(friends.unblock(ADA, GRACE)).rejects.toThrow(NotFoundException);
    });
  });

  describe('isBlocked', () => {
    it('is true for both people, whoever placed the block', async () => {
      prisma.seed(ADA, GRACE, 'BLOCKED', ADA);

      expect(await friends.isBlocked(ADA, GRACE)).toBe(true);
      expect(await friends.isBlocked(GRACE, ADA)).toBe(true);
    });

    it('is false for friends and for strangers', async () => {
      prisma.seed(ADA, GRACE, 'ACCEPTED', ADA);

      expect(await friends.isBlocked(ADA, GRACE)).toBe(false);
      expect(await friends.isBlocked(ADA, LIN)).toBe(false);
    });
  });
});
