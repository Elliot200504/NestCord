import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse, ApiNotFoundResponse } from '@nestjs/swagger';

import type { PermissionFlag } from '@nestcord/shared';

import { ServerPermissionGuard } from './server-permission.guard';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

/**
 * Guard a route on a server permission. The route must have a `:serverId` param —
 * that is where the guard looks to know which server to resolve against.
 *
 * Pass no flag to require membership alone (for read routes where being in the
 * server is the whole check).
 */
export function RequirePermission(flag?: PermissionFlag) {
  return applyDecorators(
    SetMetadata(REQUIRED_PERMISSION_KEY, flag ?? null),
    UseGuards(ServerPermissionGuard),
    ApiNotFoundResponse({ description: 'No such server, or you are not a member of it' }),
    ApiForbiddenResponse({ description: 'You lack the required permission' }),
  );
}
