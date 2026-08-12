import { Module } from '@nestjs/common';

import { PermissionsModule } from '../common/permissions/permissions.module';
import { MemberRolesController, RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [PermissionsModule],
  controllers: [RolesController, MemberRolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
