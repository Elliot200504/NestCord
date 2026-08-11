import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';

import {
  ACCENT_COLOR_PATTERN,
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@nestcord/shared';

/**
 * Every field is optional so the form can send only what changed. `null` clears a
 * field, which is why the nullable ones use `ValidateIf` rather than `IsOptional`
 * alone — otherwise "clear my bio" and "leave my bio alone" look identical.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'ada',
    minLength: USERNAME_MIN_LENGTH,
    maxLength: USERNAME_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)
  @Matches(USERNAME_PATTERN, {
    message: 'username may only contain letters, digits, dots and underscores',
  })
  username?: string;

  @ApiPropertyOptional({ example: 'Ada L.', maxLength: DISPLAY_NAME_MAX_LENGTH, nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @IsOptional()
  @IsString()
  @Length(1, DISPLAY_NAME_MAX_LENGTH)
  displayName?: string | null;

  @ApiPropertyOptional({ maxLength: BIO_MAX_LENGTH, nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @IsOptional()
  @IsString()
  @Length(1, BIO_MAX_LENGTH)
  bio?: string | null;

  @ApiPropertyOptional({ example: '#e0234e', nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @IsOptional()
  @IsString()
  @Matches(ACCENT_COLOR_PATTERN, { message: 'accentColor must be a hex colour such as #e0234e' })
  accentColor?: string | null;
}
