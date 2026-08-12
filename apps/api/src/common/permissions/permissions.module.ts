import { Module } from '@nestjs/common';

import { PermissionsService } from './permissions.service';
import { ServerPermissionGuard } from './server-permission.guard';

/**
 * Server permission resolution, imported by every module that guards a server
 * resource — servers, channels, messages, and later the gateway.
 */
@Module({
  providers: [PermissionsService, ServerPermissionGuard],
  exports: [PermissionsService, ServerPermissionGuard],
})
export class PermissionsModule {}
