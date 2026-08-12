import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  has,
  MESSAGE_PAGE_SIZE,
  Permission,
  type Message,
  type MessageReaction,
  type Paginated,
} from '@nestcord/shared';

import { AttachmentsService } from '../attachments/attachments.service';
import type { MemberContext } from '../common/permissions/member-context';
import { PermissionsService } from '../common/permissions/permissions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { groupReactions, MESSAGE_SELECT, toMessage } from './message-response';
import type { CreateMessageDto } from './dto/create-message.dto';
import type { ListMessagesDto } from './dto/list-messages.dto';
import type { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly attachments: AttachmentsService,
  ) {}

  /**
   * One page of history, newest first (PLAN.MD §8).
   *
   * The cursor is the id of the oldest message on the previous page. One extra row is
   * fetched beyond the page to answer "is there more" without a second count query;
   * it is dropped before the response, so `nextCursor` is null exactly when the
   * channel has no older messages.
   */
  async list(
    member: MemberContext,
    channelId: string,
    dto: ListMessagesDto,
  ): Promise<Paginated<Message>> {
    await this.permissions.requireChannelPermission(member, channelId, Permission.VIEW_CHANNEL);

    const limit = dto.limit ?? MESSAGE_PAGE_SIZE;

    const rows = await this.prisma.client.message.findMany({
      where: { channelId },
      select: MESSAGE_SELECT,
      // Id breaks ties, so two messages in the same millisecond keep a stable order
      // and the cursor can never skip or repeat one.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(dto.before ? { cursor: { id: dto.before }, skip: 1 } : {}),
    });

    const page = rows.slice(0, limit);

    return {
      items: page.map((row) => toMessage(row, member.userId)),
      nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /**
   * SEND_MESSAGES is checked *in this channel*, so an override that takes it away
   * here is respected even when the member has it at server level.
   */
  async create(member: MemberContext, channelId: string, dto: CreateMessageDto): Promise<Message> {
    const permissions = await this.permissions.requireChannelPermission(
      member,
      channelId,
      Permission.SEND_MESSAGES,
    );

    const content = (dto.content ?? '').trim();
    const attachmentIds = [...new Set(dto.attachmentIds ?? [])];

    if (!content && attachmentIds.length === 0) {
      throw new BadRequestException('A message needs text or an attachment');
    }

    if (attachmentIds.length > 0 && !has(permissions, Permission.ATTACH_FILES)) {
      throw new ForbiddenException('You cannot attach files in this channel');
    }

    await this.attachments.requireClaimable(member.userId, attachmentIds);

    const replyToId = await this.resolveReplyTo(channelId, dto.replyToId);

    const message = await this.prisma.client.message.create({
      data: {
        channelId,
        authorId: member.userId,
        content,
        replyToId,
        ...(attachmentIds.length === 0
          ? {}
          : { attachments: { connect: attachmentIds.map((id) => ({ id })) } }),
      },
      select: MESSAGE_SELECT,
    });

    return toMessage(message, member.userId);
  }

  /**
   * Only the author may edit, and MANAGE_MESSAGES does not change that — a moderator
   * can remove a message but must never be able to put words in someone's mouth.
   */
  async update(
    member: MemberContext,
    channelId: string,
    messageId: string,
    dto: UpdateMessageDto,
  ): Promise<Message> {
    await this.permissions.requireChannelPermission(member, channelId, Permission.VIEW_CHANNEL);

    const existing = await this.findInChannel(channelId, messageId);

    if (existing.authorId !== member.userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const content = dto.content.trim();

    if (!content) throw new BadRequestException('A message cannot be edited to nothing');

    const message = await this.prisma.client.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      select: MESSAGE_SELECT,
    });

    return toMessage(message, member.userId);
  }

  /**
   * Authors may delete their own; MANAGE_MESSAGES in this channel may delete anyone's.
   *
   * Replies to this message survive it — `replyToId` is `SetNull`, so a conversation
   * does not disappear because one message in it was removed.
   */
  async remove(member: MemberContext, channelId: string, messageId: string): Promise<void> {
    const permissions = await this.permissions.requireChannelPermission(
      member,
      channelId,
      Permission.VIEW_CHANNEL,
    );

    const existing = await this.findInChannel(channelId, messageId);

    if (existing.authorId !== member.userId && !has(permissions, Permission.MANAGE_MESSAGES)) {
      throw new ForbiddenException('You need Manage Messages to delete someone else’s message');
    }

    await this.prisma.client.message.delete({ where: { id: messageId } });

    // The rows went with the message by cascade; the files on disk are ours to clean.
    await this.attachments.removeFiles(existing.attachments.map((attachment) => attachment.url));
  }

  /** Adds the caller's own reaction. Reacting twice with the same emoji is a no-op. */
  async addReaction(
    member: MemberContext,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<MessageReaction[]> {
    await this.permissions.requireChannelPermission(member, channelId, Permission.ADD_REACTIONS);
    await this.findInChannel(channelId, messageId);

    await this.prisma.client.reaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId: member.userId, emoji } },
      update: {},
      create: { messageId, userId: member.userId, emoji },
    });

    return this.reactions(messageId, member.userId);
  }

  /**
   * Removes the caller's own reaction, and only ever their own — clearing someone
   * else's is not something the UI offers, so there is no permission for it.
   */
  async removeReaction(
    member: MemberContext,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<MessageReaction[]> {
    await this.permissions.requireChannelPermission(member, channelId, Permission.VIEW_CHANNEL);
    await this.findInChannel(channelId, messageId);

    await this.prisma.client.reaction.deleteMany({
      where: { messageId, userId: member.userId, emoji },
    });

    return this.reactions(messageId, member.userId);
  }

  private async reactions(messageId: string, viewerId: string): Promise<MessageReaction[]> {
    const rows = await this.prisma.client.reaction.findMany({
      where: { messageId },
      select: { emoji: true, userId: true },
      orderBy: { createdAt: 'asc' },
    });

    return groupReactions(rows, viewerId);
  }

  /**
   * Scoped by channel so a message id from a channel the caller cannot see is not
   * reachable by passing it to one they can.
   */
  private async findInChannel(channelId: string, messageId: string) {
    const message = await this.prisma.client.message.findFirst({
      where: { id: messageId, channelId },
      select: { id: true, authorId: true, attachments: { select: { url: true } } },
    });

    if (!message) throw new NotFoundException('No such message');

    return message;
  }

  /** A reply has to point at a message in the same channel, or at nothing. */
  private async resolveReplyTo(
    channelId: string,
    replyToId: string | undefined,
  ): Promise<string | null> {
    if (!replyToId) return null;

    const target = await this.findInChannel(channelId, replyToId);

    return target.id;
  }
}
