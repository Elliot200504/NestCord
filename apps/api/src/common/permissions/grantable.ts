import { ForbiddenException } from '@nestjs/common';

import { ALL_PERMISSIONS } from '@nestcord/shared';

/**
 * You cannot grant what you do not hold. Without this, MANAGE_ROLES alone would be
 * enough to mint an ADMINISTRATOR role — or an ADMINISTRATOR channel override — and
 * take the server.
 *
 * Unknown bits are masked off rather than rejected, so a client sending a flag we do
 * not have cannot store a permission nothing can later revoke.
 *
 * Returns the bits that may actually be written.
 */
export function grantablePermissions(actorPermissions: number, requested: number): number {
  const known = requested & ALL_PERMISSIONS;
  const ungrantable = known & ~actorPermissions;

  if (ungrantable !== 0) {
    throw new ForbiddenException('You cannot grant a permission you do not have yourself');
  }

  return known;
}
