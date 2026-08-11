/**
 * Development seed: a small but realistic world to click around in.
 *
 * Run with `pnpm db:seed`. Safe to re-run — it clears the tables it owns first.
 * Because of that it refuses to run against anything but a local database.
 */
import { resolve } from 'node:path';

import * as argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';

import { ALL_PERMISSIONS, DEFAULT_EVERYONE_PERMISSIONS, Permission } from '@nestcord/shared';

import { createPrismaClient } from '../src/index.js';

loadEnv({ path: resolve(process.cwd(), '../../.env'), quiet: true });

const prisma = createPrismaClient(process.env.DATABASE_URL ?? '');

/** The account to log in with while developing. */
const TEST_ACCOUNT = {
  username: 'testuser',
  email: 'test@nestcord.local',
  password: 'password123',
};

const USERNAMES = [
  'ada',
  'grace',
  'linus',
  'margaret',
  'dennis',
  'barbara',
  'ken',
  'radia',
  'alan',
] as const;

const SAMPLE_MESSAGES = [
  'Morning everyone 👋',
  'Has anyone looked at the new deploy?',
  'I pushed a fix for the login redirect',
  'Lunch in 20?',
  '```ts\nconst answer = 42;\n```',
  'That **finally** works',
  'Nice one!',
  'Careful, that endpoint is not paginated yet',
  'Ship it 🚀',
  'I will pick this up tomorrow',
];

/** Hosts we consider safe to wipe. */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', 'db', 'postgres'];

/**
 * The seed deletes every row in every table, so refuse to run against anything
 * that is not an obviously local development database.
 */
function assertLocalDatabase(url: string): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production.');
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('Refusing to seed: DATABASE_URL is missing or not a valid URL.');
  }

  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(
      `Refusing to seed: database host "${host}" is not local. ` +
        'The seed deletes every table. Point DATABASE_URL at a local database.',
    );
  }
}

async function clear(): Promise<void> {
  // Order matters: children before parents where cascade does not cover it.
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.ban.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.reaction.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.channelPermission.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.memberRole.deleteMany();
  await prisma.role.deleteMany();
  await prisma.serverMember.deleteMany();
  await prisma.server.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

function pick<T>(items: readonly T[], index: number): T {
  const item = items[index % items.length];
  if (item === undefined) throw new Error('pick() called on an empty list');
  return item;
}

async function main(): Promise<void> {
  assertLocalDatabase(process.env.DATABASE_URL ?? '');

  console.log('Clearing existing data...');
  await clear();

  console.log('Creating users...');
  const passwordHash = await argon2.hash(TEST_ACCOUNT.password, { type: argon2.argon2id });

  const testUser = await prisma.user.create({
    data: {
      username: TEST_ACCOUNT.username,
      email: TEST_ACCOUNT.email,
      passwordHash,
      status: 'ONLINE',
    },
  });

  const others = await Promise.all(
    USERNAMES.map((username, index) =>
      prisma.user.create({
        data: {
          username,
          email: `${username}@nestcord.local`,
          passwordHash,
          status: index % 3 === 0 ? 'ONLINE' : index % 3 === 1 ? 'IDLE' : 'OFFLINE',
        },
      }),
    ),
  );

  const users = [testUser, ...others];

  console.log('Creating servers, roles and channels...');
  const serverSpecs = [
    { name: 'NestCord HQ', channels: ['general', 'random', 'dev'] },
    { name: 'Book Club', channels: ['general', 'currently-reading'] },
    { name: 'Game Night', channels: ['general', 'planning'] },
  ];

  for (const [serverIndex, spec] of serverSpecs.entries()) {
    const owner = pick(users, serverIndex);

    const server = await prisma.server.create({
      data: { name: spec.name, ownerId: owner.id },
    });

    const everyoneRole = await prisma.role.create({
      data: {
        serverId: server.id,
        name: '@everyone',
        permissions: DEFAULT_EVERYONE_PERMISSIONS,
        position: 0,
        isDefault: true,
      },
    });

    const moderatorRole = await prisma.role.create({
      data: {
        serverId: server.id,
        name: 'Moderator',
        color: '#5865f2',
        permissions:
          DEFAULT_EVERYONE_PERMISSIONS |
          Permission.MANAGE_MESSAGES |
          Permission.KICK_MEMBERS |
          Permission.BAN_MEMBERS,
        position: 1,
      },
    });

    const adminRole = await prisma.role.create({
      data: {
        serverId: server.id,
        name: 'Admin',
        color: '#eb459e',
        permissions: ALL_PERMISSIONS,
        position: 2,
      },
    });

    // Everyone joins the first server; the others get a subset.
    const memberUsers = serverIndex === 0 ? users : users.slice(0, 5);

    for (const [memberIndex, user] of memberUsers.entries()) {
      const member = await prisma.serverMember.create({
        data: { serverId: server.id, userId: user.id },
      });

      const roleIds = [everyoneRole.id];
      if (user.id === owner.id) roleIds.push(adminRole.id);
      else if (memberIndex % 4 === 1) roleIds.push(moderatorRole.id);

      await prisma.memberRole.createMany({
        data: roleIds.map((roleId) => ({ memberId: member.id, roleId })),
      });
    }

    const category = await prisma.channel.create({
      data: { serverId: server.id, name: 'Text Channels', type: 'CATEGORY', position: 0 },
    });

    for (const [channelIndex, name] of spec.channels.entries()) {
      const channel = await prisma.channel.create({
        data: {
          serverId: server.id,
          name,
          type: 'TEXT',
          position: channelIndex,
          parentId: category.id,
          topic: channelIndex === 0 ? `Welcome to #${name}` : null,
        },
      });

      for (let i = 0; i < 12; i += 1) {
        const author = pick(memberUsers, i + channelIndex);
        const message = await prisma.message.create({
          data: {
            channelId: channel.id,
            authorId: author.id,
            content: pick(SAMPLE_MESSAGES, i + channelIndex),
            createdAt: new Date(Date.now() - (12 - i) * 60_000),
          },
        });

        if (i % 4 === 0) {
          await prisma.reaction.create({
            data: {
              messageId: message.id,
              userId: pick(memberUsers, i + 1).id,
              emoji: pick(['👍', '🎉', '😄'], i),
            },
          });
        }
      }
    }

    await prisma.channel.create({
      data: { serverId: server.id, name: 'General Voice', type: 'VOICE', position: 10 },
    });
  }

  console.log('Creating friendships...');
  await prisma.friendship.createMany({
    data: [
      {
        userId: testUser.id,
        friendId: pick(others, 0).id,
        status: 'ACCEPTED',
        requestedBy: testUser.id,
      },
      {
        userId: testUser.id,
        friendId: pick(others, 1).id,
        status: 'ACCEPTED',
        requestedBy: pick(others, 1).id,
      },
      {
        userId: pick(others, 2).id,
        friendId: testUser.id,
        status: 'PENDING',
        requestedBy: pick(others, 2).id,
      },
      {
        userId: testUser.id,
        friendId: pick(others, 3).id,
        status: 'BLOCKED',
        requestedBy: testUser.id,
      },
    ],
  });

  console.log('Creating DM conversations...');
  const directConversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId: testUser.id }, { userId: pick(others, 0).id }],
      },
    },
  });

  const groupConversation = await prisma.conversation.create({
    data: {
      name: 'Weekend plans',
      isGroup: true,
      participants: {
        create: [
          { userId: testUser.id },
          { userId: pick(others, 0).id },
          { userId: pick(others, 1).id },
        ],
      },
    },
  });

  for (const [index, conversation] of [directConversation, groupConversation].entries()) {
    for (let i = 0; i < 5; i += 1) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          authorId: i % 2 === 0 ? testUser.id : pick(others, index).id,
          content: pick(SAMPLE_MESSAGES, i + index + 3),
          createdAt: new Date(Date.now() - (5 - i) * 120_000),
        },
      });
    }
  }

  const counts = {
    users: await prisma.user.count(),
    servers: await prisma.server.count(),
    channels: await prisma.channel.count(),
    messages: await prisma.message.count(),
    friendships: await prisma.friendship.count(),
    conversations: await prisma.conversation.count(),
  };

  console.log('\nSeed complete:', counts);
  console.log(`\nLog in with  ${TEST_ACCOUNT.email}  /  ${TEST_ACCOUNT.password}\n`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
