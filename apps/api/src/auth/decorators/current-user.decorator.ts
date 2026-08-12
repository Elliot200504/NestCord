import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import type { RequestUser } from '../auth.service';

/**
 * The user the guard attached to the request. Only usable on guarded routes — on a
 * `@Public()` route there is nobody to inject, and silently passing `undefined`
 * would push that surprise into every service.
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  requestUser(context),
);

/**
 * The session the request's token was issued for. Routes that talk about "this
 * device" — revoking other sessions, marking the current one in a list — need it.
 */
export const CurrentSessionId = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => requestUser(context).sessionId,
);

function requestUser(context: ExecutionContext): RequestUser {
  const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();

  if (!request.user) {
    throw new UnauthorizedException('This route requires authentication');
  }

  return request.user;
}
