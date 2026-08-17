import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Permission, type ServerBan } from '@nestcord/shared';

import type { MemberContext } from '../common/permissions/member-context';
import { Member } from '../common/permissions/member.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { BansService } from './bans.service';
import { CreateBanDto } from './dto/create-ban.dto';
import { ServerBanDto } from './dto/moderation.dto';

@ApiTags('servers')
@ApiBearerAuth()
@Controller('servers/:serverId/bans')
export class BansController {
  constructor(private readonly bans: BansService) {}

  @Get()
  @RequirePermission(Permission.BAN_MEMBERS)
  @ApiOperation({ summary: 'Everyone barred from the server' })
  @ApiOkResponse({ type: [ServerBanDto] })
  list(@Member() member: MemberContext): Promise<ServerBan[]> {
    return this.bans.list(member.serverId);
  }

  // PUT, not POST: banning the same person twice should be the same request, and
  // the target is named in the URL rather than in the body.
  @Put(':userId')
  @RequirePermission(Permission.BAN_MEMBERS)
  @ApiOperation({ summary: 'Ban a user, whether or not they are currently a member' })
  @ApiOkResponse({ type: ServerBanDto })
  create(
    @Member() member: MemberContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateBanDto,
  ): Promise<ServerBan> {
    return this.bans.create(member, userId, dto);
  }

  @Delete(':userId')
  @RequirePermission(Permission.BAN_MEMBERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Lift a ban so the user may use an invite again' })
  @ApiNoContentResponse()
  remove(
    @Member() member: MemberContext,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.bans.remove(member, userId);
  }
}
