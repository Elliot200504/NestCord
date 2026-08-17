import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

import { CONVERSATION_NAME_MAX_LENGTH, GROUP_DM_MAX_PARTICIPANTS } from '@nestcord/shared';

/**
 * One route opens both kinds of conversation: one id means a one-to-one DM, more
 * than one means a group (PLAN.MD §19). The caller is never listed — they are always
 * in the conversation they are opening.
 *
 * The maximum is one below the group cap because the creator takes the last place.
 */
export class CreateConversationDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    minItems: 1,
    maxItems: GROUP_DM_MAX_PARTICIPANTS - 1,
    description: 'Who to open it with, not counting yourself',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(GROUP_DM_MAX_PARTICIPANTS - 1)
  @IsUUID(undefined, { each: true })
  userIds!: string[];

  @ApiPropertyOptional({
    maxLength: CONVERSATION_NAME_MAX_LENGTH,
    description: 'Groups only — a one-to-one DM is titled after the other person',
  })
  @IsOptional()
  @IsString()
  @Length(1, CONVERSATION_NAME_MAX_LENGTH)
  name?: string;
}
