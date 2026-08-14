import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { GROUP_DM_MAX_PARTICIPANTS, type Conversation } from '@nestcord/shared';

import { PrismaService } from '../common/prisma/prisma.service';
import { FriendsService } from '../friends/friends.service';
import { RealtimeService } from '../gateway/realtime.service';
import {
  byRecentActivity,
  CONVERSATION_SELECT,
  toConversation,
  type ConversationRow,
} from './conversation-response';
import type { AddParticipantsDto } from './dto/add-participants.dto';
import type { CreateConversationDto } from './dto/create-conversation.dto';
import type { UpdateConversationDto } from './dto/update-conversation.dto';

/**
 * Direct messages and group DMs (PLAN.MD §19).
 *
 * There are no roles here and no permission bitfield: being a participant is the
 * whole authorization model. Every method starts by proving the caller is in the
 * conversation, and a caller who is not gets a 404 rather than a 403 — a
 * conversation someone is not part of should not be discoverable by its id.
 *
 * Blocking is honoured on the way in and on the way through: you cannot open a DM
 * with someone either side has blocked, and `DmMessagesService` re-checks before
 * every send, because a block can land after the conversation exists.
 */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Your conversations, most recently active first. */
  async list(viewerId: string): Promise<Conversation[]> {
    const rows = await this.prisma.client.conversation.findMany({
      where: { participants: { some: { userId: viewerId } } },
      select: CONVERSATION_SELECT,
    });

    return rows.map(toConversation).sort(byRecentActivity);
  }

  /** One conversation you are in. */
  async find(viewerId: string, conversationId: string): Promise<Conversation> {
    return toConversation(await this.requireParticipant(viewerId, conversationId));
  }

  /**
   * Opens a conversation: one other person makes a DM, more than one makes a group.
   *
   * Opening a DM twice returns the one that already exists rather than making a
   * second — a pair has one conversation, and two would split their history. Groups
   * are not deduplicated: the same people can have several groups, which is the
   * point of naming them.
   */
  async create(viewerId: string, dto: CreateConversationDto): Promise<Conversation> {
    const userIds = [...new Set(dto.userIds)].filter((userId) => userId !== viewerId);

    if (userIds.length === 0) throw new BadRequestException('You cannot open a DM with yourself');

    await this.requireUsersExist(userIds);
    await this.requireNoneBlocked(viewerId, userIds);

    const [other, ...rest] = userIds;
    const isGroup = rest.length > 0;

    if (!isGroup && dto.name) {
      throw new BadRequestException('Only a group DM can be named');
    }

    if (other && !isGroup) {
      const existing = await this.findDirect(viewerId, other);

      if (existing) return toConversation(existing);
    }

    const created = await this.prisma.client.conversation.create({
      data: {
        isGroup,
        name: isGroup ? (dto.name ?? null) : null,
        participants: { create: [viewerId, ...userIds].map((userId) => ({ userId })) },
      },
      select: CONVERSATION_SELECT,
    });

    const conversation = toConversation(created);

    await this.realtime.conversationCreated(conversation);

    return conversation;
  }

  /** Renames a group, or clears its name. A one-to-one DM has no name to change. */
  async rename(
    viewerId: string,
    conversationId: string,
    dto: UpdateConversationDto,
  ): Promise<Conversation> {
    const existing = await this.requireParticipant(viewerId, conversationId);

    if (!existing.isGroup) throw new BadRequestException('A one-to-one DM cannot be renamed');

    const updated = await this.prisma.client.conversation.update({
      where: { id: conversationId },
      data: { name: dto.name?.trim() || null },
      select: CONVERSATION_SELECT,
    });

    return toConversation(updated);
  }

  /**
   * Adds people to a group. Anyone already in it may invite, which is the same rule
   * Discord uses — a group DM has no owner to ask.
   */
  async addParticipants(
    viewerId: string,
    conversationId: string,
    dto: AddParticipantsDto,
  ): Promise<Conversation> {
    const existing = await this.requireParticipant(viewerId, conversationId);

    if (!existing.isGroup) {
      throw new BadRequestException('A one-to-one DM cannot take more people');
    }

    const present = new Set(existing.participants.map((participant) => participant.userId));
    const userIds = [...new Set(dto.userIds)].filter((userId) => !present.has(userId));

    if (userIds.length === 0) return toConversation(existing);

    if (present.size + userIds.length > GROUP_DM_MAX_PARTICIPANTS) {
      throw new BadRequestException(`A group DM holds at most ${GROUP_DM_MAX_PARTICIPANTS} people`);
    }

    await this.requireUsersExist(userIds);
    await this.requireNoneBlocked(viewerId, userIds);

    const updated = await this.prisma.client.conversation.update({
      where: { id: conversationId },
      data: { participants: { create: userIds.map((userId) => ({ userId })) } },
      select: CONVERSATION_SELECT,
    });

    const conversation = toConversation(updated);

    // Same announcement a new group gets: the people who were just added need their
    // sockets in the room, and everyone's list needs the conversation in it.
    await this.realtime.conversationCreated(conversation);

    return conversation;
  }

  /**
   * Leaves a group. The last person out takes the conversation with them — an empty
   * conversation is unreachable, and its messages go by cascade.
   *
   * A one-to-one DM cannot be left: there is no such thing as half a pair, and
   * closing it is a client-side act rather than a stored one.
   */
  async leave(viewerId: string, conversationId: string): Promise<void> {
    const existing = await this.requireParticipant(viewerId, conversationId);

    if (!existing.isGroup) throw new BadRequestException('A one-to-one DM cannot be left');

    await this.prisma.client.conversationParticipant.delete({
      where: { conversationId_userId: { conversationId, userId: viewerId } },
    });

    if (existing.participants.length === 1) {
      await this.prisma.client.conversation.delete({ where: { id: conversationId } });
    }

    await this.realtime.conversationLeft(conversationId, viewerId);
  }

  /**
   * The conversation, if the caller is in it.
   *
   * Shared with `DmMessagesService`: every DM route needs this exact check first, so
   * there is one place that decides what "you are in this conversation" means.
   */
  async requireParticipant(viewerId: string, conversationId: string): Promise<ConversationRow> {
    const conversation = await this.prisma.client.conversation.findFirst({
      where: { id: conversationId, participants: { some: { userId: viewerId } } },
      select: CONVERSATION_SELECT,
    });

    if (!conversation) throw new NotFoundException('No such conversation');

    return conversation;
  }

  /**
   * Refuses a send in a one-to-one DM where a block now stands.
   *
   * Groups are left alone: a block is between two people, and letting one of them
   * silence a conversation other people are also in is not what blocking means.
   */
  async requireSendable(viewerId: string, conversation: ConversationRow): Promise<void> {
    if (conversation.isGroup) return;

    const other = conversation.participants.find(
      (participant) => participant.userId !== viewerId,
    )?.userId;

    if (!other) return;

    if (await this.friends.isBlocked(viewerId, other)) {
      throw new ForbiddenException('You cannot send messages in this conversation');
    }
  }

  /** The one-to-one conversation between two people, if they already have one. */
  private async findDirect(a: string, b: string): Promise<ConversationRow | null> {
    const candidates = await this.prisma.client.conversation.findMany({
      where: {
        isGroup: false,
        AND: [{ participants: { some: { userId: a } } }, { participants: { some: { userId: b } } }],
      },
      select: CONVERSATION_SELECT,
    });

    // Both are in it, but a stray third would make it something else — so the pair
    // is confirmed by size rather than trusted from the query alone.
    return candidates.find((candidate) => candidate.participants.length === 2) ?? null;
  }

  private async requireUsersExist(userIds: string[]): Promise<void> {
    const found = await this.prisma.client.user.count({ where: { id: { in: userIds } } });

    if (found !== userIds.length) throw new NotFoundException('No such user');
  }

  /**
   * Every message here is deliberately the same whichever side placed the block, so
   * this cannot be used to find out that someone has blocked you.
   */
  private async requireNoneBlocked(viewerId: string, userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      if (await this.friends.isBlocked(viewerId, userId)) {
        throw new ForbiddenException('You cannot open a conversation with that user');
      }
    }
  }
}
