import { Module } from '@nestjs/common';

import { AttachmentsModule } from '../attachments/attachments.module';
import { FriendsModule } from '../friends/friends.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import {
  DmAttachmentsController,
  DmMessagesController,
  DmReactionsController,
} from './dm-messages.controller';
import { DmMessagesService } from './dm-messages.service';

/**
 * Direct messages (PLAN.MD §19).
 *
 * `FriendsModule` is here for one question — is this pair blocked — which belongs to
 * friends and is asked rather than re-queried. The message shape, DTOs and mapper
 * come from the messages module by import, so a DM and a channel message stay the
 * same thing on the wire.
 */
@Module({
  imports: [FriendsModule, AttachmentsModule, GatewayModule, NotificationsModule],
  controllers: [
    ConversationsController,
    DmMessagesController,
    DmReactionsController,
    DmAttachmentsController,
  ],
  providers: [ConversationsService, DmMessagesService],
})
export class DmsModule {}
