import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Permission, type ServerMember } from '@nestcord/shared';

import type { MemberContext } from '../common/permissions/member-context';
import { Member } from '../common/permissions/member.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { ServerMemberDto } from './dto/server.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MembersService } from './members.service';
import { ServersService } from './servers.service';

@ApiTags('servers')
@ApiBearerAuth()
@Controller('servers/:serverId/members')
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly servers: ServersService,
  ) {}

  @Get()
  @RequirePermission()
  @ApiOperation({ summary: 'Everyone in the server' })
  @ApiOkResponse({ type: [ServerMemberDto] })
  list(@Member() member: MemberContext): Promise<ServerMember[]> {
    return this.members.list(member.serverId);
  }

  // Before `:userId`: "@me" is not a uuid, and this literal must win the match.
  @Delete('@me')
  @RequirePermission()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a server' })
  @ApiNoContentResponse()
  leave(@Member() member: MemberContext): Promise<void> {
    return this.servers.leave(member);
  }

  @Patch(':userId')
  // Membership only: changing your *own* nickname needs no permission, and the
  // service is what distinguishes that from editing somebody else's.
  @RequirePermission()
  @ApiOperation({ summary: 'Set a nickname — your own, or another member’s with MANAGE_SERVER' })
  @ApiOkResponse({ type: ServerMemberDto })
  update(
    @Member() member: MemberContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<ServerMember> {
    return this.members.update(member, userId, dto);
  }

  @Delete(':userId')
  @RequirePermission(Permission.KICK_MEMBERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from the server' })
  @ApiNoContentResponse()
  kick(
    @Member() member: MemberContext,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.members.kick(member, userId);
  }
}
