import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

import { MESSAGE_MAX_LENGTH } from '@nestcord/shared';

/**
 * An edit only ever changes the text. Attachments cannot be added or removed after
 * the fact, and the reply target is part of what was said — changing either would
 * rewrite history rather than fix a typo.
 */
export class UpdateMessageDto {
  @ApiProperty({ maxLength: MESSAGE_MAX_LENGTH })
  @IsString()
  @Length(1, MESSAGE_MAX_LENGTH)
  content!: string;
}
