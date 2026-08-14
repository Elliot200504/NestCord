import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  MESSAGE_PAGE_SIZE,
  type Message,
  type MessageReaction,
  type Paginated,
} from '@nestcord/shared';

import { AttachmentsService } from '../attachments/attachments.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../gateway/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateMessageDto } from '../messages/dto/create-message.dto';
import type { ListMessagesDto } from '../messages/dto/list-messages.dto';
import type { UpdateMessageDto } from '../messages/dto/update-message.dto';
import { reactionsOf } from '../messages/message-reactions';
import { MESSAGE_SELECT, toMessage } from '../messages/message-response';
import { ConversationsService } from './conversations.service';

/**
 * Messages inside a DM — the same message system as a channel, with a different
 * question at the door (PLAN.MD §19).
 *
 * Everything about what a message *is* comes from the messages module: the same
 * select, the same mapper, the same DTOs, so a DM and a channel message are the same
 * shape on the wire and the web client can render both with one component. What
 * differs is authorization, and only that lives here: there are no permission flags
 * in a conversation, only participants.
 *
 * One rule is deliberately unlike a channel: nobody can delete anyone else's message.
 * A channel has moderators; a DM has no one standing above the people in it.
 */
@Injectable()
export class DmMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly attachments: AttachmentsService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  /** One page of history, newest first — the same cursor rules as a channel. */
  async list(
    viewerId: string,
    conversationId: string,
    dto: ListMessagesDto,
  ): Promise<Paginated<Message>> {
    await this.conversations.requireParticipant(viewerId, conversationId);

    const limit = dto.limit ?? MESSAGE_PAGE_SIZE;

    const rows = await this.prisma.client.message.findMany({
      where: { conversationId },
      select: MESSAGE_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(dto.before ? { cursor: { id: dto.before }, skip: 1 } : {}),
    });

    const page = rows.slice(0, limit);

    return {
      items: page.map((row) => toMessage(row, viewerId)),
      nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async create(viewerId: string, conversationId: string, dto: CreateMessageDto): Promise<Message> {
    const conversation = await this.conversations.requireParticipant(viewerId, conversationId);

    // Re-checked per send, not just when the conversation was opened: a block placed
    // afterwards has to stop the next message, not only the next conversation.
    await this.conversations.requireSendable(viewerId, conversation);

    const content = (dto.content ?? '').trim();
    const attachmentIds = [...new Set(dto.attachmentIds ?? [])];

    if (!content && attachmentIds.length === 0) {
      throw new BadRequestException('A message needs text or an attachment');
    }

    await this.attachments.requireClaimable(viewerId, attachmentIds);

    const replyToId = await this.resolveReplyTo(conversationId, dto.replyToId);

    const message = await this.prisma.client.message.create({
      data: {
        conversationId,
        authorId: viewerId,
        content,
        replyToId,
        ...(attachmentIds.length === 0
          ? {}
          : { attachments: { connect: attachmentIds.map((id) => ({ id })) } }),
      },
      select: MESSAGE_SELECT,
    });

    const sent = { ...toMessage(message, viewerId), ...(dto.nonce && { nonce: dto.nonce }) };

    // Written first, then broadcast — the same order every other send follows.
    this.realtime.messageCreated(sent);

    await this.notifications.notifyDirectMessage(
      sent,
      conversation.participants.map((participant) => participant.userId),
    );

    return sent;
  }

  /** Only the author may edit, exactly as in a channel. */
  async update(
    viewerId: string,
    conversationId: string,
    messageId: string,
    dto: UpdateMessageDto,
  ): Promise<Message> {
    await this.conversations.requireParticipant(viewerId, conversationId);

    const existing = await this.findInConversation(conversationId, messageId);

    if (existing.authorId !== viewerId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const content = dto.content.trim();

    if (!content) throw new BadRequestException('A message cannot be edited to nothing');

    const message = await this.prisma.client.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      select: MESSAGE_SELECT,
    });

    const edited = toMessage(message, viewerId);

    this.realtime.messageUpdated(edited);

    return edited;
  }

  /** Your own messages only — a DM has no moderator to delete someone else's. */
  async remove(viewerId: string, conversationId: string, messageId: string): Promise<void> {
    await this.conversations.requireParticipant(viewerId, conversationId);

    const existing = await this.findInConversation(conversationId, messageId);

    if (existing.authorId !== viewerId) {
      throw new ForbiddenException('You can only delete your own messages here');
    }

    await this.prisma.client.message.delete({ where: { id: messageId } });

    this.realtime.messageDeleted({ channelId: null, conversationId, messageId });

    await this.attachments.removeFiles(existing.attachments.map((attachment) => attachment.url));
  }

  async addReaction(
    viewerId: string,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<MessageReaction[]> {
    await this.conversations.requireParticipant(viewerId, conversationId);
    await this.findInConversation(conversationId, messageId);

    await this.prisma.client.reaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId: viewerId, emoji } },
      update: {},
      create: { messageId, userId: viewerId, emoji },
    });

    this.realtime.reactionAdded({
      channelId: null,
      conversationId,
      messageId,
      emoji,
      userId: viewerId,
    });

    return reactionsOf(this.prisma, messageId, viewerId);
  }

  async removeReaction(
    viewerId: string,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<MessageReaction[]> {
    await this.conversations.requireParticipant(viewerId, conversationId);
    await this.findInConversation(conversationId, messageId);

    await this.prisma.client.reaction.deleteMany({
      where: { messageId, userId: viewerId, emoji },
    });

    this.realtime.reactionRemoved({
      channelId: null,
      conversationId,
      messageId,
      emoji,
      userId: viewerId,
    });

    return reactionsOf(this.prisma, messageId, viewerId);
  }

  /**
   * Scoped by conversation, so a message id from a DM the caller is not in is not
   * reachable by passing it to one they are.
   */
  private async findInConversation(conversationId: string, messageId: string) {
    const message = await this.prisma.client.message.findFirst({
      where: { id: messageId, conversationId },
      select: { id: true, authorId: true, attachments: { select: { url: true } } },
    });

    if (!message) throw new NotFoundException('No such message');

    return message;
  }

  /** A reply has to point at a message in the same conversation, or at nothing. */
  private async resolveReplyTo(
    conversationId: string,
    replyToId: string | undefined,
  ): Promise<string | null> {
    if (!replyToId) return null;

    const target = await this.findInConversation(conversationId, replyToId);

    return target.id;
  }
}
