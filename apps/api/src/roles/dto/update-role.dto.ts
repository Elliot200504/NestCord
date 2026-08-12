import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Matches, Min, ValidateIf } from 'class-validator';

import { ACCENT_COLOR_PATTERN, ROLE_NAME_MAX_LENGTH } from '@nestcord/shared';

export class UpdateRoleDto {
  @ApiPropertyOptional({ maxLength: ROLE_NAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @Length(1, ROLE_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ nullable: true, example: '#4c8bf5' })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Matches(ACCENT_COLOR_PATTERN, { message: 'color must be a six-digit hex colour like #4c8bf5' })
  color?: string | null;

  @ApiPropertyOptional({ minimum: 0, description: 'Permission bitfield' })
  @IsOptional()
  @IsInt()
  @Min(0)
  permissions?: number;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Higher wins. Must stay below your own top role.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
