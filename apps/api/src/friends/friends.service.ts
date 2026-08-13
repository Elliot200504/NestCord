import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { friendshipPair, type Friend } from '@nestcord/shared';

import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FRIENDSHIP_SELECT, toFriend, type FriendshipRow } from './friend-response';

/**
 * Friends and blocking (PLAN.MD §18).
 *
 * One row holds one relationship between two people, in canonical id order — see
 * `friendshipPair`. Every method here works out what the *caller* is allowed to see and do
 * with that row, because the row itself is symmetrical: it does not know which half
 * of the pair is asking.
 *
 * Blocking rules worth stating plainly, since they are the part that protects people:
 * a blocked user is told nothing — no "you are blocked" message, and the block does
 * not appear in their own list — and only the person who blocked can lift it.
 */
@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Everyone you have a relationship with: friends, pending requests both ways, and
   * the people you have blocked.
   *
   * A block someone else placed on you is filtered out rather than returned with a
   * status, so being blocked is indistinguishable from never having been connected.
   */
  async list(viewerId: string): Promise<Friend[]> {
    const rows = await this.prisma.client.friendship.findMany({
      where: { OR: [{ userId: viewerId }, { friendId: viewerId }] },
      select: FRIENDSHIP_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return rows
      .filter((row) => row.status !== 'BLOCKED' || row.requestedBy === viewerId)
      .map((row) => toFriend(row, viewerId));
  }

  /**
   * Sends a friend request, addressed by username.
   *
   * Asking someone who has already asked you accepts their request instead of
   * stacking a second one — two people reaching for each other at the same time
   * means yes, not a conflict.
   */
  async sendRequest(viewerId: string, username: string): Promise<Friend> {
    const target = await this.prisma.client.user.findUnique({
      // Exact, not case-insensitive: `username` is unique case-sensitively, so
      // `Ada` and `ada` can both exist and a loose match could address the wrong
      // account. Mentions resolve exactly for the same reason.
      where: { username },
      select: { id: true },
    });

    if (!target) throw new NotFoundException('No user by that name');
    if (target.id === viewerId) throw new BadRequestException('You cannot add yourself');

    const existing = await this.findPair(viewerId, target.id);

    if (existing) {
      if (existing.status === 'BLOCKED') {
        // Deliberately the same answer whichever side placed the block, so this
        // route cannot be used to discover that you have been blocked.
        throw new ForbiddenException('You cannot send a request to that user');
      }

      if (existing.status === 'ACCEPTED') {
        throw new ConflictException('You are already friends');
      }

      if (existing.requestedBy === viewerId) {
        throw new ConflictException('You have already asked that user');
      }

      return this.acceptRow(existing, viewerId);
    }

    const created = await this.prisma.client.friendship.create({
      data: {
        ...friendshipPair(viewerId, target.id),
        status: 'PENDING',
        requestedBy: viewerId,
      },
      select: FRIENDSHIP_SELECT,
    });

    // The recipient's copy of the row, so the notification names the sender.
    const friend = toFriend(created, target.id);

    await this.notifications.notifyFriendRequest(target.id, created.id, friend.user);

    return toFriend(created, viewerId);
  }

  /** Accepts a request someone sent you. Your own outgoing request is not yours to accept. */
  async accept(viewerId: string, userId: string): Promise<Friend> {
    const existing = await this.findPair(viewerId, userId);

    if (!existing || existing.status !== 'PENDING') {
      throw new NotFoundException('No pending request from that user');
    }

    if (existing.requestedBy === viewerId) {
      throw new ForbiddenException('You cannot accept your own request');
    }

    return this.acceptRow(existing, viewerId);
  }

  /**
   * Rejects a request, withdraws one, or removes a friend — all of which are the
   * same act on the same row, so they are the same route.
   *
   * A block is not removable this way: that would let someone you blocked clear it.
   */
  async remove(viewerId: string, userId: string): Promise<void> {
    const existing = await this.findPair(viewerId, userId);

    if (!existing || existing.status === 'BLOCKED') {
      throw new NotFoundException('You have no friendship with that user');
    }

    await this.prisma.client.friendship.delete({ where: { id: existing.id } });
  }

  /**
   * Blocks someone, whatever the relationship was before — a pending request or an
   * accepted friendship is replaced by the block.
   *
   * If they already blocked you, their block stands and this changes nothing: the
   * pair is already blocked, and overwriting who placed it would let you lift a
   * block that was not yours.
   */
  async block(viewerId: string, userId: string): Promise<Friend> {
    if (userId === viewerId) throw new BadRequestException('You cannot block yourself');

    const target = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!target) throw new NotFoundException('No such user');

    const existing = await this.findPair(viewerId, userId);

    if (existing?.status === 'BLOCKED') return toFriend(existing, viewerId);

    const pair = friendshipPair(viewerId, userId);

    const blocked = await this.prisma.client.friendship.upsert({
      where: { userId_friendId: pair },
      create: { ...pair, status: 'BLOCKED', requestedBy: viewerId },
      update: { status: 'BLOCKED', requestedBy: viewerId },
      select: FRIENDSHIP_SELECT,
    });

    return toFriend(blocked, viewerId);
  }

  /** Lifts a block you placed. Nothing else can lift it. */
  async unblock(viewerId: string, userId: string): Promise<void> {
    const existing = await this.findPair(viewerId, userId);

    if (!existing || existing.status !== 'BLOCKED' || existing.requestedBy !== viewerId) {
      throw new NotFoundException('You have not blocked that user');
    }

    await this.prisma.client.friendship.delete({ where: { id: existing.id } });
  }

  /**
   * Whether these two may exchange messages.
   *
   * Exported for the DM slice, which must refuse a conversation with someone either
   * side has blocked. Kept here so "what does blocked mean" has one answer.
   */
  async isBlocked(userId: string, otherUserId: string): Promise<boolean> {
    const existing = await this.findPair(userId, otherUserId);

    return existing?.status === 'BLOCKED';
  }

  /** The one row for a pair, whichever way round the caller names them. */
  private async findPair(a: string, b: string): Promise<FriendshipRow | null> {
    return this.prisma.client.friendship.findUnique({
      where: { userId_friendId: friendshipPair(a, b) },
      select: FRIENDSHIP_SELECT,
    });
  }

  private async acceptRow(row: FriendshipRow, viewerId: string): Promise<Friend> {
    const accepted = await this.prisma.client.friendship.update({
      where: { id: row.id },
      data: { status: 'ACCEPTED' },
      select: FRIENDSHIP_SELECT,
    });

    return toFriend(accepted, viewerId);
  }
}
