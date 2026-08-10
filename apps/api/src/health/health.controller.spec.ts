import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../common/prisma/prisma.service';
import { HealthController } from './health.controller';

function buildController(queryRaw: () => Promise<unknown>) {
  return Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: PrismaService, useValue: { client: { $queryRaw: queryRaw } } }],
  }).compile();
}

describe('HealthController', () => {
  it('reports ok when the database answers', async () => {
    const moduleRef = await buildController(vi.fn().mockResolvedValue([{ '?column?': 1 }]));
    const controller = moduleRef.get(HealthController);

    await expect(controller.check()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('reports degraded instead of throwing when the database is unreachable', async () => {
    const moduleRef = await buildController(vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const controller = moduleRef.get(HealthController);

    await expect(controller.check()).resolves.toEqual({ status: 'degraded', database: 'down' });
  });
});
