import { Module } from '@nestjs/common';

import { AuditLogService } from './audit-log.service';

/**
 * The audit log, imported by every module that performs a moderation action:
 * servers (kick, ban), messages, channels and roles.
 */
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
