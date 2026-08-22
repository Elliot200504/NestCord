import { Injectable } from '@nestjs/common';

import {
  mentionedUsernames,
  mentionsEveryone,
  type Message,
  type NotificationPayload,
  type PublicUser,
} from '@nestcord/shared';

import { PUBLIC_USER_SELECT } from '../auth/public-user';
import { PermissionsService } from '../common/permissions/permissions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../gateway/realtime.service';

/** A mention preview is a glance, not the message. */
const PREVIEW_MAX_LENGTH = 120;

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  sourceId: true,
  readAt: true,
  createdAt: true,
} as const;

/**
 * Notifications (PLAN.MD §20). Mentions today; friend requests, DMs and invites join
 * this when those features land.
 *
 * Persistence is deliberately thin — a row saying "you were mentioned in this
 * message" — because everything needed to render one can be read back from the
 * message it points at. The realtime payload carries that context so a connected
 * client needs no follow-up request.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Notifies whoever a message mentions.
   *
   * Only people who can actually see the channel are notified — a mention must never
   * become a way to reach someone who cannot read where it was said. The author is
   * never notified about their own message.
   */
  async notifyMentions(message: Message, serverId: string): Promise<void> {
    // Mentions are a channel idea: who can see a channel is what decides who may be
    // reached. A DM has no such question, and notifies everyone in it instead.
    if (!message.channelId) return;

    const recipients = await this.mentionRecipients(message, message.channelId);

    if (recipients.length === 0) return;

    // One row each, then one broadcast each. `createMany` cannot return the ids, and
    // the payload needs them, so this is a create per recipient — at a handful of
    // mentions per message that is the simpler trade.
    for (const userId of recipients) {
      const notification = await this.prisma.client.notification.create({
        data: { userId, type: 'MENTION', sourceId: message.id },
        select: NOTIFICATION_SELECT,
      });

      this.realtime.notify(userId, {
        id: notification.id,
        type: 'MENTION',
        sourceId: message.id,
        createdAt: notification.createdAt.toISOString(),
        actor: message.author,
        serverId,
        channelId: message.channelId,
        conversationId: null,
        preview: preview(message.content),
      });
    }
  }

  /**
   * Tells someone they have a friend request (PLAN.MD §20).
   *
   * `sourceId` is the friendship row, and the actor travels in the payload, so a
   * connected client can render the request without a follow-up fetch.
   */
  async notifyFriendRequest(
    recipientId: string,
    friendshipId: string,
    actor: PublicUser,
  ): Promise<void> {
    const notification = await this.prisma.client.notification.create({
      data: { userId: recipientId, type: 'FRIEND_REQUEST', sourceId: friendshipId },
      select: NOTIFICATION_SELECT,
    });

    this.realtime.notify(recipientId, {
      id: notification.id,
      type: 'FRIEND_REQUEST',
      sourceId: friendshipId,
      createdAt: notification.createdAt.toISOString(),
      actor,
      serverId: null,
      channelId: null,
      conversationId: null,
      preview: null,
    });
  }

  /**
   * Tells the other people in a conversation that a DM landed (PLAN.MD §20).
   *
   * Everyone in it is notified rather than only people who were mentioned: a DM is
   * addressed to you by existing, which is the whole difference from a channel. The
   * author is never notified about their own message.
   */
  async notifyDirectMessage(message: Message, participantIds: string[]): Promise<void> {
    const recipients = participantIds.filter((userId) => userId !== message.author.id);

    for (const userId of recipients) {
      const notification = await this.prisma.client.notification.create({
        data: { userId, type: 'DIRECT_MESSAGE', sourceId: message.id },
        select: NOTIFICATION_SELECT,
      });

      this.realtime.notify(userId, {
        id: notification.id,
        type: 'DIRECT_MESSAGE',
        sourceId: message.id,
        createdAt: notification.createdAt.toISOString(),
        actor: message.author,
        serverId: null,
        channelId: null,
        conversationId: message.conversationId,
        preview: preview(message.content),
      });
    }
  }

  /** Your unread notifications, newest first. */
  async list(userId: string): Promise<NotificationPayload[]> {
    const notifications = await this.prisma.client.notification.findMany({
      where: { userId, readAt: null },
      select: NOTIFICATION_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const messages = await this.messageSources(notifications);
    const requesters = await this.friendRequestActors(notifications);

    return notifications
      .filter((notification) => {
        if (notification.sourceId === null) return true;

        // A notification whose subject is gone — the message was deleted, the request
        // was withdrawn — has nowhere to send you and nothing to show.
        if (notification.type === 'MENTION' || notification.type === 'DIRECT_MESSAGE') {
          return messages.has(notification.sourceId);
        }

        if (notification.type === 'FRIEND_REQUEST') return requesters.has(notification.sourceId);

        return true;
      })
      .map((notification) => {
        const source = notification.sourceId ? messages.get(notification.sourceId) : undefined;
        const requester = notification.sourceId ? requesters.get(notification.sourceId) : undefined;

        return {
          id: notification.id,
          type: notification.type,
          sourceId: notification.sourceId,
          createdAt: notification.createdAt.toISOString(),
          actor: source?.author ?? requester ?? null,
          serverId: source?.channel?.serverId ?? null,
          channelId: source?.channelId ?? null,
          conversationId: source?.conversationId ?? null,
          preview: source ? preview(source.content) : null,
        };
      });
  }

  /** Marks one notification read, or all of them when no id is given. */
  async markRead(userId: string, notificationId?: string): Promise<void> {
    await this.prisma.client.notification.updateMany({
      // Scoped by user, so an id belonging to someone else matches nothing.
      where: { userId, readAt: null, ...(notificationId ? { id: notificationId } : {}) },
      data: { readAt: new Date() },
    });
  }

  private async mentionRecipients(message: Message, channelId: string): Promise<string[]> {
    const viewers = await this.permissions.findChannelViewers(channelId);
    const canSee = new Set(viewers);

    if (mentionsEveryone(message.content)) {
      return viewers.filter((userId) => userId !== message.author.id);
    }

    const usernames = mentionedUsernames(message.content);

    if (usernames.length === 0) return [];

    // Resolved against real accounts: `@nobody` notifies nobody, which is also how
    // the client renders it. Matched without case, because the names arrive
    // lowercased and `username` is a case-sensitive column — an exact match would
    // leave `@Ada` notifying nobody while the client rendered it as a mention. Two
    // accounts differing only in case both get told, which is the kinder failure.
    const mentioned = await this.prisma.client.user.findMany({
      where: {
        OR: usernames.map((username) => ({
          username: { equals: username, mode: 'insensitive' as const },
        })),
      },
      select: { id: true },
    });

    return mentioned
      .map((user) => user.id)
      .filter((userId) => userId !== message.author.id && canSee.has(userId));
  }

  /** The messages behind a page of mention and DM notifications, in one query. */
  private async messageSources(notifications: Array<{ type: string; sourceId: string | null }>) {
    const ids = notifications
      .filter(
        (notification) => notification.type === 'MENTION' || notification.type === 'DIRECT_MESSAGE',
      )
      .map((notification) => notification.sourceId)
      .filter((sourceId): sourceId is string => sourceId !== null);

    if (ids.length === 0) return new Map<string, MessageSource>();

    const messages = await this.prisma.client.message.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        content: true,
        channelId: true,
        conversationId: true,
        channel: { select: { serverId: true } },
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            accentColor: true,
            status: true,
          },
        },
      },
    });

    return new Map(messages.map((message) => [message.id, message]));
  }

  /**
   * Who sent each pending friend request in a page of notifications, in one query.
   *
   * A friendship row is symmetrical, so the sender is whichever side of the pair
   * matches `requestedBy` — the same resolution the friends module does, but for one
   * field, which is not worth a cross-module call.
   */
  private async friendRequestActors(
    notifications: Array<{ type: string; sourceId: string | null }>,
  ): Promise<Map<string, PublicUser>> {
    const ids = notifications
      .filter((notification) => notification.type === 'FRIEND_REQUEST')
      .map((notification) => notification.sourceId)
      .filter((sourceId): sourceId is string => sourceId !== null);

    if (ids.length === 0) return new Map();

    const friendships = await this.prisma.client.friendship.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        requestedBy: true,
        user: { select: PUBLIC_USER_SELECT },
        friend: { select: PUBLIC_USER_SELECT },
      },
    });

    return new Map(
      friendships.map((friendship) => [
        friendship.id,
        friendship.user.id === friendship.requestedBy ? friendship.user : friendship.friend,
      ]),
    );
  }
}

type MessageSource = {
  id: string;
  content: string;
  channelId: string | null;
  conversationId: string | null;
  channel: { serverId: string } | null;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    accentColor: string | null;
    status: 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'OFFLINE';
  };
};

/** Enough of the message to recognise it, on one line. */
function preview(content: string): string {
  const flat = content.replaceAll(/\s+/g, ' ').trim();

  return flat.length > PREVIEW_MAX_LENGTH ? `${flat.slice(0, PREVIEW_MAX_LENGTH)}…` : flat;
}
