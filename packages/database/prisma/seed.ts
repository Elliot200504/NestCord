/**
 * Development seed: the one account you log in with, and nothing else.
 *
 * Run with `pnpm db:seed`. It creates a single user and leaves every other table
 * alone, so servers, channels and messages are whatever you have made yourself.
 * Re-running is safe: if the account already exists the seed reports it and
 * changes nothing — it will not reset a password you have since changed.
 *
 * This is also the account the error log expects. Put its email in `ADMIN_EMAILS`
 * to see the admin section in settings.
 */
import { resolve } from 'node:path';

import * as argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';

import { assertLocalDatabase } from '../src/assert-local-database.js';
import { createPrismaClient } from '../src/index.js';

loadEnv({ path: resolve(process.cwd(), '../../.env'), quiet: true });

const prisma = createPrismaClient(process.env.DATABASE_URL ?? '');

/** The account to log in with while developing. */
const ADMIN_ACCOUNT = {
  username: 'testuser',
  email: 'test@nestcord.local',
  password: 'password123',
  displayName: 'Test User',
  bio: 'The account you develop against.',
  accentColor: '#e0234e',
};

async function main(): Promise<void> {
  assertLocalDatabase(process.env.DATABASE_URL ?? '');

  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_ACCOUNT.email },
    select: { id: true, username: true },
  });

  if (existing) {
    console.log(
      `\nAccount ${ADMIN_ACCOUNT.email} already exists (@${existing.username}). Nothing to do.\n` +
        'Delete the row first if you want a fresh one with the documented password.\n',
    );
    return;
  }

  const passwordHash = await argon2.hash(ADMIN_ACCOUNT.password, { type: argon2.argon2id });

  await prisma.user.create({
    data: {
      username: ADMIN_ACCOUNT.username,
      email: ADMIN_ACCOUNT.email,
      passwordHash,
      displayName: ADMIN_ACCOUNT.displayName,
      bio: ADMIN_ACCOUNT.bio,
      accentColor: ADMIN_ACCOUNT.accentColor,
      status: 'ONLINE',
    },
  });

  console.log(
    `\nCreated the development account.\n\n` +
      `  Log in with  ${ADMIN_ACCOUNT.email}  /  ${ADMIN_ACCOUNT.password}\n\n` +
      `  For the error log in settings, set in .env:\n` +
      `  ADMIN_EMAILS="${ADMIN_ACCOUNT.email}"\n\n` +
      `Everything else — servers, channels, messages — is yours to create in the app.\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
