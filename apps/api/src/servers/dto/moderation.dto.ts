import { ApiProperty } from '@nestjs/swagger';

import type { AuditAction, AuditLogEntry, ServerBan } from '@nestcord/shared';

import { PublicUserDto } from '../../auth/dto/auth-session.dto';

export class ServerBanDto implements ServerBan {
  @ApiProperty({ type: PublicUserDto })
  user!: PublicUserDto;

  @ApiProperty({ type: PublicUserDto, nullable: true, description: 'Null if that account is gone' })
  issuer!: PublicUserDto | null;

  @ApiProperty({ nullable: true, type: String, example: 'Spamming invite links' })
  reason!: string | null;

  @ApiProperty({ format: 'date-time' })
  bannedAt!: string;
}

export class AuditLogEntryDto implements AuditLogEntry {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'MEMBER_BAN' })
  action!: AuditAction;

  @ApiProperty({ type: PublicUserDto })
  actor!: PublicUserDto;

  @ApiProperty({
    type: PublicUserDto,
    nullable: true,
    description: 'Set for the member actions, when that account still exists',
  })
  targetUser!: PublicUserDto | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The user, message, channel or role the action was about',
  })
  targetId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  reason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
