import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { MODERATION_REASON_MAX_LENGTH } from '@nestcord/shared';

/**
 * A kick carries its reason in the query string rather than a body: DELETE bodies
 * are awkward for clients and proxies, and one optional string does not need one.
 */
export class KickMemberDto {
  @ApiPropertyOptional({
    maxLength: MODERATION_REASON_MAX_LENGTH,
    description: 'Why they were removed. Shown in the audit log.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MODERATION_REASON_MAX_LENGTH)
  reason?: string;
}
