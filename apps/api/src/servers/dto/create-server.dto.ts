import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

import { SERVER_NAME_MAX_LENGTH, SERVER_NAME_MIN_LENGTH } from '@nestcord/shared';

export class CreateServerDto {
  @ApiProperty({
    example: 'NestCord HQ',
    minLength: SERVER_NAME_MIN_LENGTH,
    maxLength: SERVER_NAME_MAX_LENGTH,
  })
  @IsString()
  @Length(SERVER_NAME_MIN_LENGTH, SERVER_NAME_MAX_LENGTH)
  name!: string;
}
