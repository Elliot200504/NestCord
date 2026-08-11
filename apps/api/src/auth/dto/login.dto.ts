import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

import { PASSWORD_MAX_LENGTH } from '@nestcord/shared';

export class LoginDto {
  @ApiProperty({ example: 'ada@nestcord.local' })
  @IsEmail()
  email!: string;

  // Deliberately not validated against PASSWORD_MIN_LENGTH: a rejected short
  // password would tell an attacker their guess was too short to be real.
  @ApiProperty()
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  password!: string;
}
