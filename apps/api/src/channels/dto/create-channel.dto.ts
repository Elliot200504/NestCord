import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length, ValidateIf } from 'class-validator';

import { CHANNEL_NAME_MAX_LENGTH, CHANNEL_TOPIC_MAX_LENGTH } from '@nestcord/shared';

/** Categories are created through the same route, with `type: 'CATEGORY'`. */
export const CREATABLE_CHANNEL_TYPES = ['TEXT', 'VOICE', 'CATEGORY'] as const;

export class CreateChannelDto {
  @ApiProperty({ example: 'general', maxLength: CHANNEL_NAME_MAX_LENGTH })
  @IsString()
  @Length(1, CHANNEL_NAME_MAX_LENGTH)
  name!: string;

  @ApiPropertyOptional({ enum: CREATABLE_CHANNEL_TYPES, default: 'TEXT' })
  @IsOptional()
  @IsIn(CREATABLE_CHANNEL_TYPES)
  type?: (typeof CREATABLE_CHANNEL_TYPES)[number];

  @ApiPropertyOptional({ nullable: true, maxLength: CHANNEL_TOPIC_MAX_LENGTH })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Length(0, CHANNEL_TOPIC_MAX_LENGTH)
  topic?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Category to create it in' })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  parentId?: string | null;
}
