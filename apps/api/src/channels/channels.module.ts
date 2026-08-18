import { Module } from '@nestjs/common';

import { AuditModule } from '../common/audit/audit.module';
import { PermissionsModule } from '../common/permissions/permissions.module';
import { GatewayModule } from '../gateway/gateway.module';
import { ChannelPermissionsController, ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  // GatewayModule for the voice state a channel's sidebar shows and for evicting
  // someone from a call they may no longer be in. It does not import this module, so
  // the dependency stays one-way.
  imports: [PermissionsModule, AuditModule, GatewayModule],
  controllers: [ChannelsController, ChannelPermissionsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
