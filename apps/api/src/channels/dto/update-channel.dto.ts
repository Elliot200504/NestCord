import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Length, Min, ValidateIf } from 'class-validator';

import { CHANNEL_NAME_MAX_LENGTH, CHANNEL_TOPIC_MAX_LENGTH } from '@nestcord/shared';

export class UpdateChannelDto {
  @ApiPropertyOptional({ maxLength: CHANNEL_NAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @Length(1, CHANNEL_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: CHANNEL_TOPIC_MAX_LENGTH })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Length(0, CHANNEL_TOPIC_MAX_LENGTH)
  topic?: string | null;

  @ApiPropertyOptional({ minimum: 0, description: 'Lower first, within the same category' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Move into a category, or null to move it to the top level',
  })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  parentId?: string | null;
}
