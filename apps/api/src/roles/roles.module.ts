import { Module } from '@nestjs/common';

import { AuditModule } from '../common/audit/audit.module';
import { PermissionsModule } from '../common/permissions/permissions.module';
import { MemberRolesController, RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [PermissionsModule, AuditModule],
  controllers: [RolesController, MemberRolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
