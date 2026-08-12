import { IsUUID } from 'class-validator';

import type { TypingInput } from '@nestcord/shared';

/**
 * A socket payload is user input like any other, so it gets a DTO and the same
 * validation pipe an HTTP body would.
 */
export class TypingDto implements TypingInput {
  @IsUUID()
  channelId!: string;
}
