import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

import { GROUP_DM_MAX_PARTICIPANTS } from '@nestcord/shared';

/** Inviting more people into a group DM. The service re-checks the cap against who is already in. */
export class AddParticipantsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    minItems: 1,
    maxItems: GROUP_DM_MAX_PARTICIPANTS - 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(GROUP_DM_MAX_PARTICIPANTS - 1)
  @IsUUID(undefined, { each: true })
  userIds!: string[];
}
