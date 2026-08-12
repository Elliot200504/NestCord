import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

import { NICKNAME_MAX_LENGTH } from '@nestcord/shared';

export class UpdateMemberDto {
  @ApiPropertyOptional({
    nullable: true,
    maxLength: NICKNAME_MAX_LENGTH,
    description: 'Null clears the nickname and falls back to the display name',
  })
  @IsOptional()
  // An explicit null is how the nickname gets cleared, so it must skip the string
  // checks rather than fail them.
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(NICKNAME_MAX_LENGTH)
  nickname?: string | null;
}
