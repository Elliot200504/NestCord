import { Module } from '@nestjs/common';

import { AuditModule } from '../common/audit/audit.module';
import { PermissionsModule } from '../common/permissions/permissions.module';
import { GatewayModule } from '../gateway/gateway.module';
import { AuditLogController } from './audit-log.controller';
import { BansController } from './bans.controller';
import { BansService } from './bans.service';
import { InvitesController, ServerInvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { ServerIconStorage } from './server-icon.storage';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';

@Module({
  imports: [PermissionsModule, GatewayModule, AuditModule],
  controllers: [
    ServersController,
    MembersController,
    BansController,
    AuditLogController,
    ServerInvitesController,
    InvitesController,
  ],
  providers: [ServersService, MembersService, BansService, InvitesService, ServerIconStorage],
  exports: [ServersService, MembersService],
})
export class ServersModule {}
