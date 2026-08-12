import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  INVITE_CODE_PATTERN,
  Permission,
  type Invite,
  type InvitePreview,
  type Server,
} from '@nestcord/shared';

import type { RequestUser } from '../auth/auth.service';
import { CurrentUser as User } from '../auth/decorators/current-user.decorator';
import type { MemberContext } from '../common/permissions/member-context';
import { Member } from '../common/permissions/member.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InviteDto, InvitePreviewDto } from './dto/invite.dto';
import { ServerDto } from './dto/server.dto';
import { InvitesService } from './invites.service';

/** Guessing at codes should be as slow as guessing at a login. */
const JOIN_THROTTLE = { default: { limit: 20, ttl: 60 * 60_000 } };

/** Invites belonging to one server: managing them needs MANAGE_SERVER. */
@ApiTags('invites')
@ApiBearerAuth()
@Controller('servers/:serverId/invites')
export class ServerInvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get()
  @RequirePermission(Permission.MANAGE_SERVER)
  @ApiOperation({ summary: 'Invites for this server' })
  @ApiOkResponse({ type: [InviteDto] })
  list(@Member() member: MemberContext): Promise<Invite[]> {
    return this.invites.list(member.serverId);
  }

  @Post()
  @RequirePermission(Permission.MANAGE_SERVER)
  @ApiOperation({ summary: 'Create an invite code' })
  @ApiOkResponse({ type: InviteDto })
  create(@Member() member: MemberContext, @Body() dto: CreateInviteDto): Promise<Invite> {
    return this.invites.create(member, dto);
  }

  @Delete(':code')
  @RequirePermission(Permission.MANAGE_SERVER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an invite' })
  @ApiNoContentResponse()
  revoke(@Member() member: MemberContext, @Param('code') code: string): Promise<void> {
    return this.invites.revoke(member, assertCode(code));
  }
}

/**
 * Redeeming an invite. Deliberately not under `/servers/:serverId` — the whole point
 * is that the caller is not a member yet and may not even know the server id.
 */
@ApiTags('invites')
@ApiBearerAuth()
@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Throttle(JOIN_THROTTLE)
  @Get(':code')
  @ApiOperation({ summary: 'What an invite code points at, before joining' })
  @ApiOkResponse({ type: InvitePreviewDto })
  preview(@Param('code') code: string): Promise<InvitePreview> {
    return this.invites.preview(assertCode(code));
  }

  @Throttle(JOIN_THROTTLE)
  @Post(':code')
  @ApiOperation({ summary: 'Join the server an invite points at' })
  @ApiOkResponse({ type: ServerDto })
  join(@User() user: RequestUser, @Param('code') code: string): Promise<Server> {
    return this.invites.join(user.id, assertCode(code));
  }
}

/**
 * Codes are not uuids, so `ParseUUIDPipe` cannot help. Checking the shape here keeps
 * arbitrary strings out of the query and rejects nonsense before it costs a lookup.
 */
function assertCode(code: string): string {
  if (!INVITE_CODE_PATTERN.test(code)) {
    throw new BadRequestException('That is not a valid invite code');
  }

  return code;
}
