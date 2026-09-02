import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service';
import { ErrorLogService, type ErrorRecord } from './error-log.service';

interface StubRow {
  reference: string;
  detail: string;
}

/**
 * Stands in for the two calls this service makes. What is under test is how a
 * reference is chosen, not the query — see the note in `common/testing/fake-prisma.ts`.
 *
 * `takeFirstReference` reports whatever reference is asked about first as already
 * used, whatever it happens to be. That forces the collision deterministically
 * without the test needing to control the random generator.
 */
function buildService(options: { takeFirstReference?: boolean; failWrite?: boolean } = {}) {
  const rows: StubRow[] = [];
  const asked: string[] = [];

  const prisma = {
    client: {
      errorLog: {
        findUnique: async ({ where }: { where: { reference: string } }) => {
          asked.push(where.reference);

          if (options.takeFirstReference === true && asked.length === 1) {
            return { reference: where.reference };
          }

          return rows.find((row) => row.reference === where.reference) ?? null;
        },
        create: async ({ data }: { data: StubRow }) => {
          if (options.failWrite === true) throw new Error('the database is down');

          if (rows.some((row) => row.reference === data.reference)) {
            // What Prisma throws for a duplicate on a unique column.
            throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
          }

          rows.push(data);

          return data;
        },
      },
    },
  } as unknown as PrismaService;

  return { service: new ErrorLogService(prisma), rows, asked };
}

const failure: ErrorRecord = {
  statusCode: 500,
  detail: 'it broke',
  method: 'GET',
  path: '/api/servers',
};

describe('ErrorLogService.record', () => {
  it('returns a reference a row actually exists under', async () => {
    const { service, rows } = buildService();

    const reference = await service.record(failure);

    expect(rows.map((row) => row.reference)).toContain(reference);
  });

  it('does not reuse a reference another row already has', async () => {
    const { service, rows, asked } = buildService({ takeFirstReference: true });

    const reference = await service.record(failure);

    // It asked about a second candidate, and returned that one instead.
    expect(asked.length).toBeGreaterThan(1);
    expect(reference).not.toBe(asked[0]);
    // The reference the user is shown resolves to exactly one row, with this failure.
    expect(rows.filter((row) => row.reference === reference)).toHaveLength(1);
    expect(rows.find((row) => row.reference === reference)?.detail).toBe('it broke');
  });

  it('still returns a reference when the row cannot be written at all', async () => {
    const { service } = buildService({ failWrite: true });

    // Never throws: the request has already failed, and a second error would
    // replace the response with a more confusing one.
    await expect(service.record(failure)).resolves.toMatch(/^ERR-[0-9A-F]{6}$/);
  });
});
