import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { DEFAULT_EVERYONE_PERMISSIONS, Permission } from '@nestcord/shared';

import { AttachmentsService } from '../attachments/attachments.service';
import type { AttachmentStorage } from '../attachments/attachment.storage';
import type { MemberContext } from '../common/permissions/member-context';
import { PermissionsService } from '../common/permissions/permissions.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import { MessagesService } from './messages.service';

const SERVER = 'server-1';
const CHANNEL = 'channel-1';
const OTHER_CHANNEL = 'channel-2';
const EVERYONE_ROLE = 'role-everyone';
const AUTHOR = 'user-author';
const BYSTANDER = 'user-bystander';

interface StubMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  replyToId: string | null;
  editedAt: Date | null;
  createdAt: Date;
}

interface StubReaction {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

interface StubAttachment {
  id: string;
  uploaderId: string;
  messageId: string | null;
  url: string;
}

interface StubOverride {
  channelId: string;
  type: 'ROLE' | 'MEMBER';
  roleId: string | null;
  userId: string | null;
  allow: number;
  deny: number;
}

function member(overrides: Partial<MemberContext> = {}): MemberContext {
  return {
    serverId: SERVER,
    memberId: 'member-1',
    userId: AUTHOR,
    isOwner: false,
    permissions: DEFAULT_EVERYONE_PERMISSIONS,
    roleIds: [EVERYONE_ROLE],
    highestPosition: 0,
    ...overrides,
  };
}

function message(overrides: Partial<StubMessage> = {}): StubMessage {
  return {
    id: 'message-1',
    channelId: CHANNEL,
    authorId: AUTHOR,
    content: 'hello',
    replyToId: null,
    editedAt: null,
    createdAt: new Date('2026-08-12T10:00:00Z'),
    ...overrides,
  };
}

interface Harness {
  messages: MessagesService;
  rows: StubMessage[];
  reactions: StubReaction[];
  attachments: StubAttachment[];
  removedFiles: string[];
}

/**
 * Records writes instead of performing them: the rules are what is under test, not
 * the queries — see the note in `common/testing/fake-prisma.ts`.
 */
function buildHarness(options: {
  rows?: StubMessage[];
  reactions?: StubReaction[];
  attachments?: StubAttachment[];
  overrides?: StubOverride[];
}): Harness {
  const rows = options.rows ?? [];
  const reactions = options.reactions ?? [];
  const attachments = options.attachments ?? [];
  const overrides = options.overrides ?? [];
  const removedFiles: string[] = [];
  let nextId = 1;

  const user = (id: string) => ({
    id,
    username: id,
    displayName: null,
    avatarUrl: null,
    accentColor: null,
    status: 'ONLINE' as const,
  });

  /** A row as `MESSAGE_SELECT` asks for it. */
  const hydrate = (row: StubMessage) => {
    const target = rows.find((candidate) => candidate.id === row.replyToId);

    return {
      ...row,
      author: user(row.authorId),
      replyTo: target
        ? { id: target.id, content: target.content, author: user(target.authorId) }
        : null,
      attachments: attachments
        .filter((attachment) => attachment.messageId === row.id)
        .map((attachment) => ({
          id: attachment.id,
          filename: 'file.png',
          mimeType: 'image/png',
          size: 10,
          url: attachment.url,
        })),
      reactions: reactions
        .filter((reaction) => reaction.messageId === row.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((reaction) => ({ emoji: reaction.emoji, userId: reaction.userId })),
    };
  };

  /** Newest first, id breaking ties — the ordering the service asks Prisma for. */
  const newestFirst = (a: StubMessage, b: StubMessage) =>
    b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1);

  const prisma = {
    client: {
      channel: {
        findFirst: async ({ where }: { where: { id: string; serverId: string } }) => {
          if (where.serverId !== SERVER) return null;
          if (![CHANNEL, OTHER_CHANNEL].includes(where.id)) return null;

          return {
            overrides: overrides
              .filter((entry) => entry.channelId === where.id)
              .map((entry) => ({ ...entry, role: entry.roleId ? { isDefault: true } : null })),
          };
        },
      },

      message: {
        findMany: async ({
          where,
          take,
          cursor,
          skip,
        }: {
          where: { channelId: string };
          take: number;
          cursor?: { id: string };
          skip?: number;
        }) => {
          const ordered = rows.filter((row) => row.channelId === where.channelId).sort(newestFirst);

          const start = cursor ? ordered.findIndex((row) => row.id === cursor.id) + (skip ?? 0) : 0;

          return ordered.slice(start, start + take).map(hydrate);
        },

        findFirst: async ({ where }: { where: { id: string; channelId: string } }) => {
          const found = rows.find(
            (row) => row.id === where.id && row.channelId === where.channelId,
          );

          if (!found) return null;

          return {
            id: found.id,
            authorId: found.authorId,
            attachments: attachments
              .filter((attachment) => attachment.messageId === found.id)
              .map((attachment) => ({ url: attachment.url })),
          };
        },

        create: async ({
          data,
        }: {
          data: {
            channelId: string;
            authorId: string;
            content: string;
            replyToId: string | null;
            attachments?: { connect: Array<{ id: string }> };
          };
        }) => {
          const row = message({
            id: `message-${++nextId}`,
            channelId: data.channelId,
            authorId: data.authorId,
            content: data.content,
            replyToId: data.replyToId,
            createdAt: new Date('2026-08-12T11:00:00Z'),
          });

          rows.push(row);

          for (const { id } of data.attachments?.connect ?? []) {
            const index = attachments.findIndex((attachment) => attachment.id === id);
            const claimed = attachments[index];
            if (claimed) attachments[index] = { ...claimed, messageId: row.id };
          }

          return hydrate(row);
        },

        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { content: string; editedAt: Date };
        }) => {
          const index = rows.findIndex((row) => row.id === where.id);
          const current = rows[index];
          if (!current) throw new Error(`No message ${where.id}`);

          const next = { ...current, ...data };
          rows[index] = next;

          return hydrate(next);
        },

        delete: async ({ where }: { where: { id: string } }) => {
          const index = rows.findIndex((row) => row.id === where.id);
          const [removed] = rows.splice(index, 1);

          return removed;
        },
      },

      reaction: {
        upsert: async ({
          where,
        }: {
          where: { messageId_userId_emoji: { messageId: string; userId: string; emoji: string } };
        }) => {
          const key = where.messageId_userId_emoji;
          const exists = reactions.some(
            (reaction) =>
              reaction.messageId === key.messageId &&
              reaction.userId === key.userId &&
              reaction.emoji === key.emoji,
          );

          if (!exists) reactions.push({ ...key, createdAt: new Date() });

          return key;
        },

        deleteMany: async ({
          where,
        }: {
          where: { messageId: string; userId: string; emoji: string };
        }) => {
          const kept = reactions.filter(
            (reaction) =>
              !(
                reaction.messageId === where.messageId &&
                reaction.userId === where.userId &&
                reaction.emoji === where.emoji
              ),
          );

          const count = reactions.length - kept.length;
          reactions.splice(0, reactions.length, ...kept);

          return { count };
        },

        findMany: async ({ where }: { where: { messageId: string } }) =>
          reactions
            .filter((reaction) => reaction.messageId === where.messageId)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((reaction) => ({ emoji: reaction.emoji, userId: reaction.userId })),
      },

      attachment: {
        count: async ({
          where,
        }: {
          where: { id: { in: string[] }; uploaderId: string; messageId: null };
        }) =>
          attachments.filter(
            (attachment) =>
              where.id.in.includes(attachment.id) &&
              attachment.uploaderId === where.uploaderId &&
              attachment.messageId === null,
          ).length,
      },
    },
  } as unknown as PrismaService;

  const storage = {
    remove: async (url: string) => {
      removedFiles.push(url);
    },
  } as unknown as AttachmentStorage;

  const permissions = new PermissionsService(prisma);

  return {
    messages: new MessagesService(prisma, permissions, new AttachmentsService(prisma, storage)),
    rows,
    reactions,
    attachments,
    removedFiles,
  };
}

/**
 * A moderator, deliberately not an administrator: ADMINISTRATOR short-circuits the
 * resolution before overrides are applied, which would hide the rule under test.
 */
const MODERATOR_PERMISSIONS = DEFAULT_EVERYONE_PERMISSIONS | Permission.MANAGE_MESSAGES;

/** An override that takes one permission away from `@everyone` in `CHANNEL`. */
function denyEveryone(deny: number): StubOverride {
  return { channelId: CHANNEL, type: 'ROLE', roleId: EVERYONE_ROLE, userId: null, allow: 0, deny };
}

describe('MessagesService.list', () => {
  it('returns the newest messages first', async () => {
    const { messages } = buildHarness({
      rows: [
        message({ id: 'old', createdAt: new Date('2026-08-12T09:00:00Z') }),
        message({ id: 'new', createdAt: new Date('2026-08-12T10:00:00Z') }),
      ],
    });

    const page = await messages.list(member(), CHANNEL, {});

    expect(page.items.map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('reports no next cursor when the channel start is reached', async () => {
    const { messages } = buildHarness({ rows: [message()] });

    const page = await messages.list(member(), CHANNEL, {});

    expect(page.nextCursor).toBeNull();
  });

  it('hands back the oldest id on the page as the cursor when there is more', async () => {
    const { messages } = buildHarness({
      rows: [
        message({ id: 'first', createdAt: new Date('2026-08-12T09:00:00Z') }),
        message({ id: 'second', createdAt: new Date('2026-08-12T10:00:00Z') }),
      ],
    });

    const page = await messages.list(member(), CHANNEL, { limit: 1 });

    expect(page.items.map((item) => item.id)).toEqual(['second']);
    expect(page.nextCursor).toBe('second');
  });

  it('continues from the cursor without repeating the message it points at', async () => {
    const { messages } = buildHarness({
      rows: [
        message({ id: 'first', createdAt: new Date('2026-08-12T09:00:00Z') }),
        message({ id: 'second', createdAt: new Date('2026-08-12T10:00:00Z') }),
      ],
    });

    const page = await messages.list(member(), CHANNEL, { limit: 1, before: 'second' });

    expect(page.items.map((item) => item.id)).toEqual(['first']);
    expect(page.nextCursor).toBeNull();
  });

  it('refuses a channel the member cannot view', async () => {
    const { messages } = buildHarness({
      rows: [message()],
      overrides: [denyEveryone(Permission.VIEW_CHANNEL)],
    });

    await expect(messages.list(member(), CHANNEL, {})).rejects.toThrow(ForbiddenException);
  });

  it('does not find a channel in another server', async () => {
    const { messages } = buildHarness({ rows: [message()] });

    await expect(
      messages.list(member({ serverId: 'server-elsewhere' }), CHANNEL, {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('groups reactions per emoji and marks the viewer’s own', async () => {
    const { messages } = buildHarness({
      rows: [message()],
      reactions: [
        { messageId: 'message-1', userId: AUTHOR, emoji: '👍', createdAt: new Date(1) },
        { messageId: 'message-1', userId: BYSTANDER, emoji: '👍', createdAt: new Date(2) },
        { messageId: 'message-1', userId: BYSTANDER, emoji: '🎉', createdAt: new Date(3) },
      ],
    });

    const page = await messages.list(member(), CHANNEL, {});

    expect(page.items[0]?.reactions).toEqual([
      { emoji: '👍', count: 2, me: true },
      { emoji: '🎉', count: 1, me: false },
    ]);
  });
});

describe('MessagesService.create', () => {
  it('sends a message and returns it', async () => {
    const { messages } = buildHarness({});

    const sent = await messages.create(member(), CHANNEL, { content: 'hello there' });

    expect(sent.content).toBe('hello there');
    expect(sent.author.id).toBe(AUTHOR);
    expect(sent.editedAt).toBeNull();
  });

  it('trims the content', async () => {
    const { messages } = buildHarness({});

    const sent = await messages.create(member(), CHANNEL, { content: '  spaced  ' });

    expect(sent.content).toBe('spaced');
  });

  it('rejects a message with neither text nor an attachment', async () => {
    const { messages } = buildHarness({});

    await expect(messages.create(member(), CHANNEL, { content: '   ' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses to send where SEND_MESSAGES is denied by an override', async () => {
    const { messages } = buildHarness({ overrides: [denyEveryone(Permission.SEND_MESSAGES)] });

    await expect(messages.create(member(), CHANNEL, { content: 'hello' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('attaches an upload of the sender’s own', async () => {
    const { messages, attachments } = buildHarness({
      attachments: [{ id: 'file-1', uploaderId: AUTHOR, messageId: null, url: '/uploads/a.png' }],
    });

    const sent = await messages.create(member(), CHANNEL, { attachmentIds: ['file-1'] });

    expect(sent.attachments.map((attachment) => attachment.id)).toEqual(['file-1']);
    expect(attachments[0]?.messageId).toBe(sent.id);
  });

  it('refuses to attach a file uploaded by someone else', async () => {
    const { messages } = buildHarness({
      attachments: [
        { id: 'file-1', uploaderId: BYSTANDER, messageId: null, url: '/uploads/a.png' },
      ],
    });

    await expect(messages.create(member(), CHANNEL, { attachmentIds: ['file-1'] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses to attach a file that is already on another message', async () => {
    const { messages } = buildHarness({
      attachments: [
        { id: 'file-1', uploaderId: AUTHOR, messageId: 'message-1', url: '/uploads/a.png' },
      ],
    });

    await expect(messages.create(member(), CHANNEL, { attachmentIds: ['file-1'] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses attachments where ATTACH_FILES is denied by an override', async () => {
    const { messages } = buildHarness({
      attachments: [{ id: 'file-1', uploaderId: AUTHOR, messageId: null, url: '/uploads/a.png' }],
      overrides: [denyEveryone(Permission.ATTACH_FILES)],
    });

    await expect(messages.create(member(), CHANNEL, { attachmentIds: ['file-1'] })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('quotes the message a reply points at', async () => {
    const { messages } = buildHarness({
      rows: [message({ id: 'target', authorId: BYSTANDER, content: 'first' })],
    });

    const sent = await messages.create(member(), CHANNEL, {
      content: 'answering',
      replyToId: 'target',
    });

    expect(sent.replyTo).toEqual({
      id: 'target',
      content: 'first',
      author: expect.objectContaining({ id: BYSTANDER }),
    });
  });

  it('refuses a reply to a message in another channel', async () => {
    const { messages } = buildHarness({
      rows: [message({ id: 'elsewhere', channelId: OTHER_CHANNEL })],
    });

    await expect(
      messages.create(member(), CHANNEL, { content: 'hi', replyToId: 'elsewhere' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('MessagesService.update', () => {
  it('edits the author’s own message and marks it edited', async () => {
    const { messages } = buildHarness({ rows: [message()] });

    const edited = await messages.update(member(), CHANNEL, 'message-1', { content: 'fixed' });

    expect(edited.content).toBe('fixed');
    expect(edited.editedAt).not.toBeNull();
  });

  it('rejects an edit from a user who is not the author', async () => {
    const { messages } = buildHarness({ rows: [message()] });

    await expect(
      messages.update(member({ userId: BYSTANDER }), CHANNEL, 'message-1', { content: 'nope' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects an edit from a moderator with MANAGE_MESSAGES', async () => {
    // Removing someone's message is moderation; rewriting it is impersonation.
    const { messages } = buildHarness({ rows: [message()] });

    await expect(
      messages.update(
        member({ userId: BYSTANDER, permissions: MODERATOR_PERMISSIONS }),
        CHANNEL,
        'message-1',
        { content: 'words in your mouth' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects an edit that would blank the message', async () => {
    const { messages } = buildHarness({ rows: [message()] });

    await expect(
      messages.update(member(), CHANNEL, 'message-1', { content: '   ' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not find a message in another channel', async () => {
    const { messages } = buildHarness({
      rows: [message({ id: 'elsewhere', channelId: OTHER_CHANNEL })],
    });

    await expect(
      messages.update(member(), CHANNEL, 'elsewhere', { content: 'reachable?' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('MessagesService.remove', () => {
  it('lets the author delete their own message', async () => {
    const { messages, rows } = buildHarness({ rows: [message()] });

    await messages.remove(member(), CHANNEL, 'message-1');

    expect(rows).toHaveLength(0);
  });

  it('refuses a delete of someone else’s message without MANAGE_MESSAGES', async () => {
    const { messages } = buildHarness({ rows: [message()] });

    await expect(
      messages.remove(member({ userId: BYSTANDER }), CHANNEL, 'message-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets MANAGE_MESSAGES delete someone else’s message', async () => {
    const { messages, rows } = buildHarness({ rows: [message()] });

    await messages.remove(
      member({ userId: BYSTANDER, permissions: MODERATOR_PERMISSIONS }),
      CHANNEL,
      'message-1',
    );

    expect(rows).toHaveLength(0);
  });

  it('honours an override that takes MANAGE_MESSAGES away in this channel', async () => {
    const { messages } = buildHarness({
      rows: [message()],
      overrides: [denyEveryone(Permission.MANAGE_MESSAGES)],
    });

    await expect(
      messages.remove(
        member({ userId: BYSTANDER, roleIds: [EVERYONE_ROLE] }),
        CHANNEL,
        'message-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deletes the files behind the message it removed', async () => {
    const { messages, removedFiles } = buildHarness({
      rows: [message()],
      attachments: [
        { id: 'file-1', uploaderId: AUTHOR, messageId: 'message-1', url: '/uploads/a.png' },
      ],
    });

    await messages.remove(member(), CHANNEL, 'message-1');

    expect(removedFiles).toEqual(['/uploads/a.png']);
  });
});

describe('MessagesService reactions', () => {
  it('adds the caller’s reaction', async () => {
    const { messages } = buildHarness({ rows: [message()] });

    const reactions = await messages.addReaction(member(), CHANNEL, 'message-1', '👍');

    expect(reactions).toEqual([{ emoji: '👍', count: 1, me: true }]);
  });

  it('reacting twice with the same emoji changes nothing', async () => {
    const { messages } = buildHarness({ rows: [message()] });

    await messages.addReaction(member(), CHANNEL, 'message-1', '👍');
    const reactions = await messages.addReaction(member(), CHANNEL, 'message-1', '👍');

    expect(reactions).toEqual([{ emoji: '👍', count: 1, me: true }]);
  });

  it('refuses to react where ADD_REACTIONS is denied by an override', async () => {
    const { messages } = buildHarness({
      rows: [message()],
      overrides: [denyEveryone(Permission.ADD_REACTIONS)],
    });

    await expect(messages.addReaction(member(), CHANNEL, 'message-1', '👍')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('takes back only the caller’s own reaction', async () => {
    const { messages } = buildHarness({
      rows: [message()],
      reactions: [
        { messageId: 'message-1', userId: AUTHOR, emoji: '👍', createdAt: new Date(1) },
        { messageId: 'message-1', userId: BYSTANDER, emoji: '👍', createdAt: new Date(2) },
      ],
    });

    const reactions = await messages.removeReaction(member(), CHANNEL, 'message-1', '👍');

    expect(reactions).toEqual([{ emoji: '👍', count: 1, me: false }]);
  });

  it('does not react to a message in another channel', async () => {
    const { messages } = buildHarness({
      rows: [message({ id: 'elsewhere', channelId: OTHER_CHANNEL })],
    });

    await expect(messages.addReaction(member(), CHANNEL, 'elsewhere', '👍')).rejects.toThrow(
      NotFoundException,
    );
  });
});
