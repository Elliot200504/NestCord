import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from '@nestcord/shared';

/**
 * Requests are addressed by username, not by id — a username is the only handle a
 * person can read off a profile and type in (PLAN.MD §18).
 */
export class SendFriendRequestDto {
  @ApiProperty({
    example: 'ada',
    minLength: USERNAME_MIN_LENGTH,
    maxLength: USERNAME_MAX_LENGTH,
  })
  @IsString()
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)
  @Matches(USERNAME_PATTERN, { message: 'That is not a valid username' })
  username!: string;
}
