import { Module } from '@nestjs/common';

import { PermissionsModule } from '../common/permissions/permissions.module';
import { ChannelPermissionsController, ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  imports: [PermissionsModule],
  controllers: [ChannelsController, ChannelPermissionsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
