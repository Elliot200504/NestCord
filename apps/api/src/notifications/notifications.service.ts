import { Injectable } from '@nestjs/common';

import {
  mentionedUsernames,
  mentionsEveryone,
  type Message,
  type NotificationPayload,
} from '@nestcord/shared';

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
    const recipients = await this.mentionRecipients(message);

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

    const messages = await this.mentionedMessages(notifications);

    return notifications
      .filter((notification) => {
        // A mention whose message has been deleted has nowhere to send you and nothing
        // to show, so it is not worth listing.
        if (notification.type !== 'MENTION') return true;

        return notification.sourceId !== null && messages.has(notification.sourceId);
      })
      .map((notification) => {
        const source = notification.sourceId ? messages.get(notification.sourceId) : undefined;

        return {
          id: notification.id,
          type: notification.type,
          sourceId: notification.sourceId,
          createdAt: notification.createdAt.toISOString(),
          actor: source?.author ?? null,
          serverId: source?.channel?.serverId ?? null,
          channelId: source?.channelId ?? null,
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

  private async mentionRecipients(message: Message): Promise<string[]> {
    const viewers = await this.permissions.findChannelViewers(message.channelId);
    const canSee = new Set(viewers);

    if (mentionsEveryone(message.content)) {
      return viewers.filter((userId) => userId !== message.author.id);
    }

    const usernames = mentionedUsernames(message.content);

    if (usernames.length === 0) return [];

    // Resolved against real accounts: `@nobody` notifies nobody, which is also how
    // the client renders it.
    const mentioned = await this.prisma.client.user.findMany({
      where: { username: { in: usernames } },
      select: { id: true },
    });

    return mentioned
      .map((user) => user.id)
      .filter((userId) => userId !== message.author.id && canSee.has(userId));
  }

  /** The messages behind a page of mention notifications, in one query. */
  private async mentionedMessages(notifications: Array<{ type: string; sourceId: string | null }>) {
    const ids = notifications
      .filter((notification) => notification.type === 'MENTION')
      .map((notification) => notification.sourceId)
      .filter((sourceId): sourceId is string => sourceId !== null);

    if (ids.length === 0) return new Map<string, MentionSource>();

    const messages = await this.prisma.client.message.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        content: true,
        channelId: true,
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
}

type MentionSource = {
  id: string;
  content: string;
  channelId: string | null;
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
