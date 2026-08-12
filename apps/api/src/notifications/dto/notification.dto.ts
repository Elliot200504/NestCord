import { ApiProperty } from '@nestjs/swagger';

import type { NotificationPayload } from '@nestcord/shared';

import { PublicUserDto } from '../../auth/dto/auth-session.dto';

const NOTIFICATION_TYPES = ['MENTION', 'FRIEND_REQUEST', 'DIRECT_MESSAGE', 'SERVER_INVITE'];

/** Documents the shape of `NotificationPayload`; the type still comes from shared. */
export class NotificationDto implements NotificationPayload {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: NOTIFICATION_TYPES })
  type!: NotificationPayload['type'];

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  sourceId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: PublicUserDto, nullable: true, description: 'Who caused it' })
  actor!: PublicUserDto | null;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  serverId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  channelId!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'One line of the message' })
  preview!: string | null;
}
