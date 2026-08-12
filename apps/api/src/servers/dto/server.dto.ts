import { ApiProperty } from '@nestjs/swagger';

import type { Server, ServerMember, ServerRole, ServerSummary } from '@nestcord/shared';

import { PublicUserDto } from '../../auth/dto/auth-session.dto';

/** Documents the shape of `ServerSummary`; the type still comes from shared. */
export class ServerSummaryDto implements ServerSummary {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'NestCord HQ' })
  name!: string;

  @ApiProperty({ nullable: true, type: String, example: '/uploads/icons/a1b2.png' })
  iconUrl!: string | null;

  @ApiProperty({ format: 'uuid' })
  ownerId!: string;
}

export class ServerRoleDto implements ServerRole {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Moderator' })
  name!: string;

  @ApiProperty({ nullable: true, type: String, example: '#4c8bf5' })
  color!: string | null;

  @ApiProperty({ description: 'Permission bitfield', example: 3 })
  permissions!: number;

  @ApiProperty({ description: 'Higher wins; hierarchy compares this' })
  position!: number;

  @ApiProperty({ description: 'True for @everyone, which cannot be deleted' })
  isDefault!: boolean;
}

export class ServerDto extends ServerSummaryDto implements Server {
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty()
  memberCount!: number;

  @ApiProperty({ type: [ServerRoleDto] })
  roles!: ServerRoleDto[];

  @ApiProperty({ description: 'Your own resolved permissions, for rendering only' })
  permissions!: number;
}

export class ServerMemberDto implements ServerMember {
  @ApiProperty({ type: PublicUserDto })
  user!: PublicUserDto;

  @ApiProperty({ nullable: true, type: String })
  nickname!: string | null;

  @ApiProperty({ format: 'date-time' })
  joinedAt!: string;

  @ApiProperty({ type: [String], format: 'uuid' })
  roleIds!: string[];
}
