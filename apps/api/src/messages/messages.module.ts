import { Module } from '@nestjs/common';

import { AttachmentsModule } from '../attachments/attachments.module';
import { PermissionsModule } from '../common/permissions/permissions.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagesController, ReactionsController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [PermissionsModule, AttachmentsModule, GatewayModule, NotificationsModule],
  controllers: [MessagesController, ReactionsController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
