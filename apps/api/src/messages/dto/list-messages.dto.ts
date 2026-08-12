import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { MESSAGE_MAX_PAGE_SIZE, MESSAGE_PAGE_SIZE } from '@nestcord/shared';

/**
 * Cursor pagination, newest first (PLAN.MD §8).
 *
 * `before` is a message id rather than a timestamp: two messages can share a
 * millisecond, and an id cursor cannot skip or repeat one when they do.
 */
export class ListMessagesDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Return messages older than this one — the previous page’s nextCursor',
  })
  @IsOptional()
  @IsUUID()
  before?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MESSAGE_MAX_PAGE_SIZE,
    default: MESSAGE_PAGE_SIZE,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MESSAGE_MAX_PAGE_SIZE)
  limit?: number;
}
