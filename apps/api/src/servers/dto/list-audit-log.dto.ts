import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * Cursor pagination, newest first — an entry id rather than a timestamp, so a page
 * boundary cannot skip or repeat a row when entries share a millisecond.
 */
export class ListAuditLogDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Return entries older than this one — the last id of the previous page',
  })
  @IsOptional()
  @IsUUID()
  before?: string;
}
