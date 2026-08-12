import { Module } from '@nestjs/common';

import { PermissionsModule } from '../common/permissions/permissions.module';
import { GatewayModule } from '../gateway/gateway.module';
import { InvitesController, ServerInvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { ServerIconStorage } from './server-icon.storage';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';

@Module({
  imports: [PermissionsModule, GatewayModule],
  controllers: [ServersController, MembersController, ServerInvitesController, InvitesController],
  providers: [ServersService, MembersService, InvitesService, ServerIconStorage],
  exports: [ServersService, MembersService],
})
export class ServersModule {}
