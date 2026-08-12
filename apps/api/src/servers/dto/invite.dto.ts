import { ApiProperty } from '@nestjs/swagger';

import type { Invite, InvitePreview } from '@nestcord/shared';

import { ServerSummaryDto } from './server.dto';

export class InviteDto implements Invite {
  @ApiProperty({ example: 'Kp3rTx9a' })
  code!: string;

  @ApiProperty({ format: 'uuid' })
  serverId!: string;

  @ApiProperty()
  uses!: number;

  @ApiProperty({ nullable: true, type: Number, description: 'Null means unlimited' })
  maxUses!: number | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  expiresAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class InvitePreviewDto implements InvitePreview {
  @ApiProperty({ example: 'Kp3rTx9a' })
  code!: string;

  @ApiProperty({ type: ServerSummaryDto })
  server!: ServerSummaryDto;

  @ApiProperty()
  memberCount!: number;
}
