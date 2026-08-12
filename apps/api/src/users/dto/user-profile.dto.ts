import { ApiProperty } from '@nestjs/swagger';

import type { CurrentUser, UserProfile, UserSession } from '@nestcord/shared';

import { PublicUserDto } from '../../auth/dto/auth-session.dto';

/** Documents the shape of `UserProfile`; the type still comes from shared. */
export class UserProfileDto extends PublicUserDto implements UserProfile {
  @ApiProperty({ nullable: true, type: String })
  bio!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class CurrentUserDto extends UserProfileDto implements CurrentUser {
  @ApiProperty({ example: 'ada@nestcord.local' })
  email!: string;
}

export class UserSessionDto implements UserSession {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  userAgent!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ description: 'True for the device making this request' })
  current!: boolean;
}
