import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

import type { ErrorLogEntry } from '@nestcord/shared';

/** Cursor pagination, newest first — a row id, for the reason the audit log uses one. */
export class ListErrorLogDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Return errors older than this one — the last id of the previous page',
  })
  @IsOptional()
  @IsUUID()
  before?: string;
}

export class ErrorLogEntryDto implements ErrorLogEntry {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ERR-9F3A2C', description: 'The code the user was shown' })
  reference!: string;

  @ApiProperty({ example: 500 })
  statusCode!: number;

  @ApiProperty({
    example: 'Prisma P2002: Unique constraint failed on the fields: (`email`)',
    description: 'The real cause. Admins only — never sent to the user who hit it.',
  })
  detail!: string;

  @ApiProperty({ nullable: true, type: String })
  stack!: string | null;

  @ApiProperty({ example: 'POST' })
  method!: string;

  @ApiProperty({ example: '/api/servers/…/channels' })
  path!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'Who hit it, if anyone was signed in. May name a deleted account.',
  })
  userId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/** Whether the caller may open the error log at all, so the UI can hide the link. */
export class AdminAccessDto {
  @ApiProperty()
  isAdmin!: boolean;
}
