import { ApiProperty } from '@nestjs/swagger';

import type { AuthSession, PresenceStatus, PublicUser } from '@nestcord/shared';

/** Documents the shape of `PublicUser` for Swagger; the type still comes from shared. */
export class PublicUserDto implements PublicUser {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ada' })
  username!: string;

  @ApiProperty({ example: 'Ada L.', nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;

  @ApiProperty({ example: '#e0234e', nullable: true, type: String })
  accentColor!: string | null;

  @ApiProperty({ enum: ['ONLINE', 'IDLE', 'DO_NOT_DISTURB', 'OFFLINE'] })
  status!: PresenceStatus;
}

export class AuthSessionDto implements AuthSession {
  @ApiProperty({
    description: 'Short-lived bearer token. The refresh token is an httpOnly cookie.',
  })
  accessToken!: string;

  @ApiProperty({ type: PublicUserDto })
  user!: PublicUserDto;
}
