import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { PermissionFlag } from '@nestcord/shared';

import type { RequestUser } from '../../auth/auth.service';
import type { MemberContext } from './member-context';
import { PermissionsService } from './permissions.service';
import { REQUIRED_PERMISSION_KEY } from './require-permission.decorator';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The request, once the guard has resolved who the caller is in this server. */
export type RequestWithMember = Request & { user?: RequestUser; member?: MemberContext };

/**
 * Resolves the caller's membership and permissions for the route's `:serverId`,
 * then attaches the result to the request so the handler does not query again.
 *
 * Applied per-route by `@RequirePermission()`, not globally — most routes have no
 * server to resolve against.
 */
@Injectable()
export class ServerPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithMember>();

    if (!request.user) {
      throw new UnauthorizedException('This route requires authentication');
    }

    // Express types a param as possibly repeated; a repeated `:serverId` is not a
    // real request, so anything but a single string is simply not found.
    const serverId = request.params.serverId;

    if (typeof serverId !== 'string' || !serverId) {
      // A programming error, not a client one: the decorator was put on a route
      // with no server in its path.
      throw new BadRequestException('This route is missing a server id');
    }

    // Guards run before pipes, so nothing has validated this yet. Rejecting it here
    // keeps a malformed id from reaching Postgres as a cast error, and tells the
    // caller no more than a real missing server would.
    if (!UUID_PATTERN.test(serverId)) {
      throw new NotFoundException('No such server');
    }

    const flag = this.reflector.getAllAndOverride<PermissionFlag | null>(REQUIRED_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    request.member = flag
      ? await this.permissions.requirePermission(serverId, request.user.id, flag)
      : await this.permissions.requireMembership(serverId, request.user.id);

    return true;
  }
}
