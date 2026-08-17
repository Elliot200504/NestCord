import { Module } from '@nestjs/common';

import { AuditModule } from '../common/audit/audit.module';
import { PermissionsModule } from '../common/permissions/permissions.module';
import { ChannelPermissionsController, ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  imports: [PermissionsModule, AuditModule],
  controllers: [ChannelsController, ChannelPermissionsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
