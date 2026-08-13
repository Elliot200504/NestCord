import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

/**
 * `FriendsService` is exported because the DM slice needs `isBlocked` — a
 * conversation with someone who blocked you must be refused, and that rule belongs
 * to this module rather than being re-queried there.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
