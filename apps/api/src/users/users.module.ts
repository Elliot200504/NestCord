import { Module } from '@nestjs/common';

import { GatewayModule } from '../gateway/gateway.module';
import { AvatarStorage } from './avatar.storage';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [GatewayModule],
  controllers: [UsersController],
  providers: [UsersService, AvatarStorage],
  exports: [UsersService],
})
export class UsersModule {}
