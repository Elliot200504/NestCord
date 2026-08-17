import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env';
import { AdminService } from './admin.service';

const USERS: Record<string, string> = {
  'user-admin': 'Admin@Example.com',
  'user-normal': 'someone@example.com',
};

function buildService(adminEmails: string) {
  const config = {
    get: () => adminEmails,
  } as unknown as ConfigService<Env, true>;

  const prisma = {
    client: {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const email = USERS[where.id];

          return email === undefined ? null : { email };
        },
      },
    },
  } as unknown as PrismaService;

  return new AdminService(config, prisma);
}

describe('AdminService', () => {
  it('admits an account whose email is listed', async () => {
    await expect(buildService('admin@example.com').isAdmin('user-admin')).resolves.toBe(true);
  });

  it('ignores case on both sides, because emails are not case sensitive', async () => {
    await expect(buildService('ADMIN@EXAMPLE.COM').isAdmin('user-admin')).resolves.toBe(true);
  });

  it('refuses an account that is not listed', async () => {
    await expect(buildService('admin@example.com').isAdmin('user-normal')).resolves.toBe(false);
  });

  it('admits nobody when no admin is configured', async () => {
    await expect(buildService('').isAdmin('user-admin')).resolves.toBe(false);
  });

  it('does not treat a trailing comma as an admin with no email', async () => {
    // A user row can never have an empty email, but the parser is what guarantees
    // a blank entry cannot match anything at all.
    await expect(buildService('admin@example.com,').isAdmin('user-normal')).resolves.toBe(false);
  });

  it('refuses an id with no account behind it', async () => {
    await expect(buildService('admin@example.com').isAdmin('deleted-user')).resolves.toBe(false);
  });

  it('reads several listed admins, spaces and all', async () => {
    const service = buildService('first@example.com, admin@example.com');

    await expect(service.isAdmin('user-admin')).resolves.toBe(true);
  });
});
