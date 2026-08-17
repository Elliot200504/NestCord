import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permission, type AuditLogEntry } from '@nestcord/shared';

import { AuditLogService } from '../common/audit/audit-log.service';
import type { MemberContext } from '../common/permissions/member-context';
import { Member } from '../common/permissions/member.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { ListAuditLogDto } from './dto/list-audit-log.dto';
import { AuditLogEntryDto } from './dto/moderation.dto';

@ApiTags('servers')
@ApiBearerAuth()
@Controller('servers/:serverId/audit-log')
export class AuditLogController {
  constructor(private readonly audit: AuditLogService) {}

  // MANAGE_SERVER rather than the individual moderation flags: the log covers
  // channels, roles, messages and members at once, so reading it is an
  // administrative view rather than part of any one of those powers.
  @Get()
  @RequirePermission(Permission.MANAGE_SERVER)
  @ApiOperation({ summary: 'Recent moderation actions, newest first' })
  @ApiOkResponse({ type: [AuditLogEntryDto] })
  list(@Member() member: MemberContext, @Query() query: ListAuditLogDto): Promise<AuditLogEntry[]> {
    return this.audit.list(member.serverId, query.before);
  }
}
