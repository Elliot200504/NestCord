import {
  createParamDecorator,
  type ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

import type { MemberContext } from './member-context';
import type { RequestWithMember } from './server-permission.guard';

/**
 * The `MemberContext` the guard resolved for this route. Only available where
 * `@RequirePermission()` ran — without it there is nothing to inject, and handing
 * back `undefined` would turn a missing decorator into a silent authorization hole.
 */
export const Member = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<RequestWithMember>();

  if (!request.member) {
    throw new InternalServerErrorException('This route is missing @RequirePermission()');
  }

  return request.member;
});

export type { MemberContext };
