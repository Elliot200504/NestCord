import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, ValidateIf } from 'class-validator';

import { CONVERSATION_NAME_MAX_LENGTH } from '@nestcord/shared';

/**
 * Renaming a group. Passing `null` clears the name, which puts the title back to the
 * participants' names — so "no name" has to be sayable, not just omittable.
 */
export class UpdateConversationDto {
  @ApiPropertyOptional({ maxLength: CONVERSATION_NAME_MAX_LENGTH, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, CONVERSATION_NAME_MAX_LENGTH)
  name?: string | null;
}
