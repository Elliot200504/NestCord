import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

import { SERVER_NAME_MAX_LENGTH, SERVER_NAME_MIN_LENGTH } from '@nestcord/shared';

export class UpdateServerDto {
  @ApiPropertyOptional({
    minLength: SERVER_NAME_MIN_LENGTH,
    maxLength: SERVER_NAME_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @Length(SERVER_NAME_MIN_LENGTH, SERVER_NAME_MAX_LENGTH)
  name?: string;
}
