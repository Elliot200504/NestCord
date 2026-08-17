import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { MODERATION_REASON_MAX_LENGTH } from '@nestcord/shared';

export class CreateBanDto {
  @ApiPropertyOptional({
    maxLength: MODERATION_REASON_MAX_LENGTH,
    description: 'Why they were banned. Shown in the ban list and the audit log.',
    example: 'Spamming invite links',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MODERATION_REASON_MAX_LENGTH)
  reason?: string;
}
