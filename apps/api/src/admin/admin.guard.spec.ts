import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { Request } from 'express';

import type { RequestUser } from '../auth/auth.service';
import type { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';

const ADMIN = 'user-ada';
const ORDINARY = 'user-grace';

function buildHarness(options: { userId?: string } = {}) {
  const asked: string[] = [];

  const request = {
    ...(options.userId === undefined ? {} : { user: { id: options.userId } }),
  } as Request & { user?: RequestUser };

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  const admin = {
    isAdmin: async (userId: string) => {
      asked.push(userId);

      return userId === ADMIN;
    },
  } as unknown as AdminService;

  return { guard: new AdminGuard(admin), context, asked };
}

describe('AdminGuard', () => {
  it('admits a configured admin', async () => {
    const harness = buildHarness({ userId: ADMIN });

    await expect(harness.guard.canActivate(harness.context)).resolves.toBe(true);
    expect(harness.asked).toEqual([ADMIN]);
  });

  it('refuses an authenticated user who is not an admin', async () => {
    const harness = buildHarness({ userId: ORDINARY });

    await expect(harness.guard.canActivate(harness.context)).rejects.toThrow(
      'You do not have access to this',
    );
  });

  it('refuses a request with no user, without asking who is an admin', async () => {
    // The global JwtAuthGuard runs first, so this means the route forgot its
    // authentication rather than that the caller is anonymous. Refused either way.
    const harness = buildHarness();

    await expect(harness.guard.canActivate(harness.context)).rejects.toThrow(
      'You do not have access to this',
    );
    expect(harness.asked).toEqual([]);
  });

  it('says the same thing to a non-admin as to an unauthenticated caller', async () => {
    // Whether an account is an admin is not something a non-admin gets to learn
    // from the error message.
    const anonymous = buildHarness();
    const ordinary = buildHarness({ userId: ORDINARY });

    const first = await anonymous.guard.canActivate(anonymous.context).catch((e: Error) => e);
    const second = await ordinary.guard.canActivate(ordinary.context).catch((e: Error) => e);

    expect((first as Error).message).toBe((second as Error).message);
  });
});
