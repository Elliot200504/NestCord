import { ApiProperty } from '@nestjs/swagger';

import type { Channel, ChannelOverride, ChannelType } from '@nestcord/shared';

/** Documents the shape of `Channel`; the type still comes from shared. */
export class ChannelDto implements Channel {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  serverId!: string;

  @ApiProperty({ example: 'general' })
  name!: string;

  @ApiProperty({ enum: ['TEXT', 'VOICE', 'CATEGORY'] })
  type!: ChannelType;

  @ApiProperty({ nullable: true, type: String, example: 'Anything goes' })
  topic!: string | null;

  @ApiProperty({ description: 'Lower first, within the same category' })
  position!: number;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  parentId!: string | null;

  @ApiProperty({ description: 'Your own resolved permissions here, for rendering only' })
  permissions!: number;
}

export class ChannelOverrideDto implements ChannelOverride {
  @ApiProperty({ enum: ['ROLE', 'MEMBER'] })
  type!: 'ROLE' | 'MEMBER';

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  roleId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  userId!: string | null;

  @ApiProperty({ description: 'Bitfield granted in this channel' })
  allow!: number;

  @ApiProperty({ description: 'Bitfield taken away in this channel' })
  deny!: number;
}
