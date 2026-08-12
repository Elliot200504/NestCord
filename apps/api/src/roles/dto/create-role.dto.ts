import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Matches, Min, ValidateIf } from 'class-validator';

import { ACCENT_COLOR_PATTERN, ALL_PERMISSIONS, ROLE_NAME_MAX_LENGTH } from '@nestcord/shared';

export class CreateRoleDto {
  @ApiProperty({ example: 'Moderator', maxLength: ROLE_NAME_MAX_LENGTH })
  @IsString()
  @Length(1, ROLE_NAME_MAX_LENGTH)
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: '#4c8bf5' })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Matches(ACCENT_COLOR_PATTERN, { message: 'color must be a six-digit hex colour like #4c8bf5' })
  color?: string | null;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: ALL_PERMISSIONS,
    description: 'Permission bitfield. Defaults to no permissions.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  // Not `@Max(ALL_PERMISSIONS)`: the flags are not contiguous, so the service
  // masks unknown bits off instead of guessing at a ceiling.
  permissions?: number;
}
