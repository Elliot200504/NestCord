import { ApiProperty } from '@nestjs/swagger';

import type { Friend } from '@nestcord/shared';

import { PublicUserDto } from '../../auth/dto/auth-session.dto';

const FRIENDSHIP_STATUSES = ['PENDING', 'ACCEPTED', 'BLOCKED'];
const FRIEND_DIRECTIONS = ['INCOMING', 'OUTGOING'];

/** Documents the shape of `Friend`; the type still comes from shared. */
export class FriendDto implements Friend {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: PublicUserDto, description: 'The other person' })
  user!: PublicUserDto;

  @ApiProperty({ enum: FRIENDSHIP_STATUSES })
  status!: Friend['status'];

  @ApiProperty({
    enum: FRIEND_DIRECTIONS,
    description: 'Who acted: who asked on PENDING, who blocked on BLOCKED',
  })
  direction!: Friend['direction'];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
