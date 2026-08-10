import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/client/client.js';

export * from '../generated/client/client.js';
export { PrismaClient };

/**
 * Build a PrismaClient. Prisma 7 requires an explicit driver adapter, so the
 * connection string is passed in rather than read from the schema.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to create a Prisma client');
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
