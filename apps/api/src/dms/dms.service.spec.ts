import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import { GROUP_DM_MAX_PARTICIPANTS, type Conversation, type PublicUser } from '@nestcord/shared';

import type { AttachmentsService } from '../attachments/attachments.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { FriendsService } from '../friends/friends.service';
import type { RealtimeService } from '../gateway/realtime.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { ConversationsService } from './conversations.service';
import { DmMessagesService } from './dm-messages.service';

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

interface StoredConversation {
  id: string;
  name: string | null;
  isGroup: boolean;
  createdAt: Date;
  participantIds: string[];
}

interface StoredMessage {
  id: string;
  conversationId: string | null;
  channelId: string | null;
  authorId: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  replyToId: string | null;
}

/**
 * An in-memory stand-in for the conversation and message queries these services make.
 *
 * Query correctness belongs to PostgreSQL. What is worth testing here is the rule
 * layer above it — who is in a conversation, who may open, send, edit or delete —
 * because that is what stands between two people's DMs and everyone else.
 */
class StubPrisma {
  private conversations: StoredConversation[] = [];
  private messages: StoredMessage[] = [];
  private nextId = 1;

  seedConversation(participantIds: string[], isGroup: boolean, name: string | null = null) {
    const conversation: StoredConversation = {
      id: `conversation-${this.nextId++}`,
      name,
      isGroup,
      createdAt: new Date('2026-08-13T09:00:00.000Z'),
      participantIds,
    };

    this.conversations = [...this.conversations, conversation];

    return conversation;
  }

  seedMessage(conversationId: string, authorId: string, content = 'hello') {
    const message: StoredMessage = {
      id: `message-${this.nextId++}`,
      conversationId,
      channelId: null,
      authorId,
      content,
      createdAt: new Date('2026-08-13T09:05:00.000Z'),
      editedAt: null,
      replyToId: null,
    };

    this.messages = [...this.messages, message];

    return message;
  }

  storedConversations(): StoredConversation[] {
    return this.conversations;
  }

  storedMessages(): StoredMessage[] {
    return this.messages;
  }

  private row(conversation: StoredConversation) {
    return {
      id: conversation.id,
      name: conversation.name,
      isGroup: conversation.isGroup,
      createdAt: conversation.createdAt,
      participants: conversation.participantIds.map((userId) => ({
        userId,
        user: USERS.get(userId) as PublicUser,
      })),
      messages: this.messages
        .filter((message) => message.conversationId === conversation.id)
        .map((message) => ({ createdAt: message.createdAt }))
        .slice(-1),
    };
  }

  private messageRow(message: StoredMessage) {
    return {
      ...message,
      author: USERS.get(message.authorId) as PublicUser,
      replyTo: null,
      attachments: [],
      reactions: [],
    };
  }

  readonly client = {
    user: {
      count: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter((id) => USERS.has(id)).length,
    },

    conversation: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const viewerId = participantFilter(where);

        return this.conversations
          .filter((conversation) => !viewerId || conversation.participantIds.includes(viewerId))
          .filter((conversation) => matchesPair(conversation, where))
          .map((conversation) => this.row(conversation));
      },

      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const viewerId = participantFilter(where);
        const found = this.conversations.find(
          (conversation) =>
            conversation.id === where.id &&
            (!viewerId || conversation.participantIds.includes(viewerId)),
        );

        return found ? this.row(found) : null;
      },

      create: async ({ data }: { data: Record<string, never> }) => {
        const input = data as unknown as {
          isGroup: boolean;
          name: string | null;
          participants: { create: Array<{ userId: string }> };
        };

        return this.row(
          this.seedConversation(
            input.participants.create.map((participant) => participant.userId),
            input.isGroup,
            input.name,
          ),
        );
      },

      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const input = data as {
          name?: string | null;
          participants?: { create: Array<{ userId: string }> };
        };

        this.conversations = this.conversations.map((conversation) =>
          conversation.id === where.id
            ? {
                ...conversation,
                name: 'name' in input ? (input.name ?? null) : conversation.name,
                participantIds: input.participants
                  ? [
                      ...conversation.participantIds,
                      ...input.participants.create.map((participant) => participant.userId),
                    ]
                  : conversation.participantIds,
              }
            : conversation,
        );

        return this.row(
          this.conversations.find(
            (conversation) => conversation.id === where.id,
          ) as StoredConversation,
        );
      },

      delete: async ({ where }: { where: { id: string } }) => {
        this.conversations = this.conversations.filter(
          (conversation) => conversation.id !== where.id,
        );
      },
    },

    conversationParticipant: {
      delete: async ({
        where,
      }: {
        where: { conversationId_userId: { conversationId: string; userId: string } };
      }) => {
        const { conversationId, userId } = where.conversationId_userId;

        this.conversations = this.conversations.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                participantIds: conversation.participantIds.filter((id) => id !== userId),
              }
            : conversation,
        );
      },
    },

    message: {
      findMany: async ({ where }: { where: { conversationId: string } }) =>
        this.messages
          .filter((message) => message.conversationId === where.conversationId)
          .map((message) => this.messageRow(message)),

      findFirst: async ({ where }: { where: { id: string; conversationId: string } }) => {
        const found = this.messages.find(
          (message) => message.id === where.id && message.conversationId === where.conversationId,
        );

        return found ? this.messageRow(found) : null;
      },

      create: async ({ data }: { data: Record<string, unknown> }) => {
        const input = data as { conversationId: string; authorId: string; content: string };

        return this.messageRow(
          this.seedMessage(input.conversationId, input.authorId, input.content),
        );
      },

      update: async ({ where, data }: { where: { id: string }; data: { content: string } }) => {
        this.messages = this.messages.map((message) =>
          message.id === where.id
            ? { ...message, content: data.content, editedAt: new Date() }
            : message,
        );

        return this.messageRow(
          this.messages.find((message) => message.id === where.id) as StoredMessage,
        );
      },

      delete: async ({ where }: { where: { id: string } }) => {
        this.messages = this.messages.filter((message) => message.id !== where.id);
      },
    },
  };
}

/** The `participants: { some: { userId } }` clause the services filter with. */
function participantFilter(where: Record<string, unknown>): string | null {
  const participants = where.participants as { some?: { userId: string } } | undefined;

  return participants?.some?.userId ?? null;
}

/** The `AND: [{ some: a }, { some: b }]` clause `findDirect` builds. */
function matchesPair(conversation: StoredConversation, where: Record<string, unknown>): boolean {
  const clauses = where.AND as Array<{ participants: { some: { userId: string } } }> | undefined;

  if (!clauses) return where.isGroup === undefined || conversation.isGroup === where.isGroup;

  return (
    conversation.isGroup === where.isGroup &&
    clauses.every((clause) => conversation.participantIds.includes(clause.participants.some.userId))
  );
}

function buildHarness(options: { blocked?: Array<[string, string]> } = {}) {
  const blocked = new Set((options.blocked ?? []).map(([a, b]) => [a, b].sort().join(':')));

  const prisma = new StubPrisma();
  const announced: Conversation[] = [];
  const broadcasts: string[] = [];
  const notified: Array<{ messageId: string; participantIds: string[] }> = [];

  const friends = {
    isBlocked: async (a: string, b: string) => blocked.has([a, b].sort().join(':')),
  } as unknown as FriendsService;

  const realtime = {
    conversationCreated: async (conversation: Conversation) => void announced.push(conversation),
    conversationLeft: async () => undefined,
    messageCreated: () => broadcasts.push('message:create'),
    messageUpdated: () => broadcasts.push('message:update'),
    messageDeleted: () => broadcasts.push('message:delete'),
  } as unknown as RealtimeService;

  const attachments = {
    requireClaimable: async () => undefined,
    removeFiles: async () => undefined,
  } as unknown as AttachmentsService;

  const notifications = {
    notifyDirectMessage: async (message: { id: string }, participantIds: string[]) =>
      void notified.push({ messageId: message.id, participantIds }),
  } as unknown as NotificationsService;

  const conversations = new ConversationsService(
    prisma as unknown as PrismaService,
    friends,
    realtime,
  );

  const messages = new DmMessagesService(
    prisma as unknown as PrismaService,
    conversations,
    attachments,
    realtime,
    notifications,
  );

  return { prisma, conversations, messages, announced, broadcasts, notified };
}

describe('ConversationsService', () => {
  let harness: ReturnType<typeof buildHarness>;

  beforeEach(() => {
    harness = buildHarness();
  });

  it('opens a one-to-one DM and returns the same one the second time', async () => {
    const first = await harness.conversations.create(ADA, { userIds: [GRACE] });
    const second = await harness.conversations.create(GRACE, { userIds: [ADA] });

    expect(second.id).toBe(first.id);
    expect(harness.prisma.storedConversations()).toHaveLength(1);
  });

  it('refuses to open a DM with yourself', async () => {
    await expect(harness.conversations.create(ADA, { userIds: [ADA] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses to open a conversation when a block stands between the two', async () => {
    const blocking = buildHarness({ blocked: [[ADA, GRACE]] });

    await expect(blocking.conversations.create(ADA, { userIds: [GRACE] })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses to name a one-to-one DM', async () => {
    await expect(
      harness.conversations.create(ADA, { userIds: [GRACE], name: 'just us' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('puts the creator in the group it opens', async () => {
    const group = await harness.conversations.create(ADA, { userIds: [GRACE, LIN], name: 'crew' });

    expect(group.isGroup).toBe(true);
    expect(group.participants.map((participant) => participant.id)).toEqual([ADA, GRACE, LIN]);
  });

  it('announces a new conversation so its participants can be joined to its room', async () => {
    const opened = await harness.conversations.create(ADA, { userIds: [GRACE] });

    expect(harness.announced.map((conversation) => conversation.id)).toEqual([opened.id]);
  });

  it('hides a conversation the caller is not in', async () => {
    const theirs = harness.prisma.seedConversation([GRACE, LIN], false);

    await expect(harness.conversations.find(ADA, theirs.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses to rename a one-to-one DM', async () => {
    const pair = harness.prisma.seedConversation([ADA, GRACE], false);

    await expect(harness.conversations.rename(ADA, pair.id, { name: 'us' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses to grow a group past the cap', async () => {
    const crowd = Array.from(
      { length: GROUP_DM_MAX_PARTICIPANTS },
      (_, index) => `filler-${index}`,
    );
    const group = harness.prisma.seedConversation([ADA, ...crowd.slice(1)], true);

    await expect(
      harness.conversations.addParticipants(ADA, group.id, { userIds: [GRACE] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('leaves a group without disturbing the people still in it', async () => {
    const group = harness.prisma.seedConversation([ADA, GRACE, LIN], true);

    await harness.conversations.leave(ADA, group.id);

    expect(harness.prisma.storedConversations()[0]?.participantIds).toEqual([GRACE, LIN]);
  });

  it('deletes a group once the last person leaves', async () => {
    const group = harness.prisma.seedConversation([ADA], true);

    await harness.conversations.leave(ADA, group.id);

    expect(harness.prisma.storedConversations()).toEqual([]);
  });

  it('refuses to leave a one-to-one DM', async () => {
    const pair = harness.prisma.seedConversation([ADA, GRACE], false);

    await expect(harness.conversations.leave(ADA, pair.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lists your conversations, most recently active first', async () => {
    const quiet = harness.prisma.seedConversation([ADA, GRACE], false);
    const busy = harness.prisma.seedConversation([ADA, LIN], false);
    harness.prisma.seedMessage(busy.id, LIN);
    harness.prisma.seedConversation([GRACE, LIN], false);

    const listed = await harness.conversations.list(ADA);

    expect(listed.map((conversation) => conversation.id)).toEqual([busy.id, quiet.id]);
  });
});

describe('DmMessagesService', () => {
  let harness: ReturnType<typeof buildHarness>;

  beforeEach(() => {
    harness = buildHarness();
  });

  it('refuses to show history to someone who is not in the conversation', async () => {
    const theirs = harness.prisma.seedConversation([GRACE, LIN], false);

    await expect(harness.messages.list(ADA, theirs.id, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses a send into a conversation the caller is not in', async () => {
    const theirs = harness.prisma.seedConversation([GRACE, LIN], false);

    await expect(
      harness.messages.create(ADA, theirs.id, { content: 'hello' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sends, broadcasts, and echoes the nonce back to the sender', async () => {
    const pair = harness.prisma.seedConversation([ADA, GRACE], false);

    const sent = await harness.messages.create(ADA, pair.id, {
      content: 'hello',
      nonce: 'nonce-1',
    });

    expect(sent.conversationId).toBe(pair.id);
    expect(sent.channelId).toBeNull();
    expect(sent.nonce).toBe('nonce-1');
    expect(harness.broadcasts).toEqual(['message:create']);
  });

  it('notifies the other people in the conversation and never the author', async () => {
    const group = harness.prisma.seedConversation([ADA, GRACE, LIN], true);

    await harness.messages.create(ADA, group.id, { content: 'hello' });

    expect(harness.notified[0]?.participantIds).toEqual([ADA, GRACE, LIN]);
  });

  it('refuses a send in a one-to-one DM once a block stands', async () => {
    const blocking = buildHarness({ blocked: [[ADA, GRACE]] });
    const pair = blocking.prisma.seedConversation([ADA, GRACE], false);

    await expect(
      blocking.messages.create(ADA, pair.id, { content: 'hello' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a group carry on when two of its members have blocked each other', async () => {
    // A block is between two people. Letting one of them silence a conversation that
    // other people are also in is not what blocking means.
    const blocking = buildHarness({ blocked: [[GRACE, LIN]] });
    const group = blocking.prisma.seedConversation([ADA, GRACE, LIN], true);

    await expect(
      blocking.messages.create(GRACE, group.id, { content: 'hello' }),
    ).resolves.toMatchObject({ content: 'hello' });
  });

  it('rejects an edit from a user who is not the author', async () => {
    const pair = harness.prisma.seedConversation([ADA, GRACE], false);
    const message = harness.prisma.seedMessage(pair.id, ADA);

    await expect(
      harness.messages.update(GRACE, pair.id, message.id, { content: 'not mine' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a delete from a participant who is not the author', async () => {
    // Unlike a channel, where Manage Messages exists. A DM has no moderator.
    const pair = harness.prisma.seedConversation([ADA, GRACE], false);
    const message = harness.prisma.seedMessage(pair.id, ADA);

    await expect(harness.messages.remove(GRACE, pair.id, message.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(harness.prisma.storedMessages()).toHaveLength(1);
  });

  it('lets the author delete their own message', async () => {
    const pair = harness.prisma.seedConversation([ADA, GRACE], false);
    const message = harness.prisma.seedMessage(pair.id, ADA);

    await harness.messages.remove(ADA, pair.id, message.id);

    expect(harness.prisma.storedMessages()).toEqual([]);
  });

  it('will not reach a message through a conversation it is not in', async () => {
    const mine = harness.prisma.seedConversation([ADA, GRACE], false);
    const theirs = harness.prisma.seedConversation([ADA, LIN], false);
    const message = harness.prisma.seedMessage(theirs.id, LIN);

    await expect(
      harness.messages.update(ADA, mine.id, message.id, { content: 'reach' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
