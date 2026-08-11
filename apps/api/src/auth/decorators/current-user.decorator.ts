import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import type { PublicUser } from '@nestcord/shared';

/**
 * The user the guard attached to the request. Only usable on guarded routes — on a
 * `@Public()` route there is nobody to inject, and silently passing `undefined`
 * would push that surprise into every service.
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request & { user?: PublicUser }>();

  if (!request.user) {
    throw new UnauthorizedException('This route requires authentication');
  }

  return request.user;
});
