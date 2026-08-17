import { ApiProperty } from '@nestjs/swagger';

import type { Conversation } from '@nestcord/shared';

import { PublicUserDto } from '../../auth/dto/auth-session.dto';

/** Documents the shape of `Conversation`; the type still comes from shared. */
export class ConversationDto implements Conversation {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Groups only — null on a one-to-one DM and on an unnamed group',
  })
  name!: string | null;

  @ApiProperty()
  isGroup!: boolean;

  @ApiProperty({ type: [PublicUserDto], description: 'Everyone in it, including you' })
  participants!: PublicUserDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    type: String,
    description: 'When the newest message landed; null while the conversation is empty',
  })
  lastMessageAt!: string | null;
}
