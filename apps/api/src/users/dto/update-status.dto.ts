import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import type { PresenceStatus } from '@nestcord/shared';

/** The statuses a user may pick for themselves. */
const SELECTABLE_STATUSES = ['ONLINE', 'IDLE', 'DO_NOT_DISTURB', 'OFFLINE'] as const;

export class UpdateStatusDto {
  @ApiProperty({ enum: SELECTABLE_STATUSES })
  @IsIn(SELECTABLE_STATUSES)
  status!: PresenceStatus;
}
