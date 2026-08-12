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
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Permission, type Channel, type ChannelOverride } from '@nestcord/shared';

import type { MemberContext } from '../common/permissions/member-context';
import { Member } from '../common/permissions/member.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { ChannelsService } from './channels.service';
import { ChannelDto, ChannelOverrideDto } from './dto/channel.dto';
import { CreateChannelDto } from './dto/create-channel.dto';
import { SetOverrideDto } from './dto/set-override.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

/**
 * Everything hangs off `/servers/:serverId` so `ServerPermissionGuard` has a server
 * to resolve the caller against. Per-channel permissions are then checked inside the
 * service, where the channel's overrides are known.
 */
@ApiTags('channels')
@ApiBearerAuth()
@Controller('servers/:serverId/channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  // Membership only: the list itself is filtered to the channels you may see.
  @RequirePermission()
  @ApiOperation({ summary: 'Channels and categories you can see in this server' })
  @ApiOkResponse({ type: [ChannelDto] })
  list(@Member() member: MemberContext): Promise<Channel[]> {
    return this.channels.list(member);
  }

  @Post()
  @RequirePermission(Permission.MANAGE_CHANNELS)
  @ApiOperation({ summary: 'Create a channel or a category' })
  @ApiOkResponse({ type: ChannelDto })
  create(@Member() member: MemberContext, @Body() dto: CreateChannelDto): Promise<Channel> {
    return this.channels.create(member, dto);
  }

  @Patch(':channelId')
  @RequirePermission(Permission.MANAGE_CHANNELS)
  @ApiOperation({ summary: 'Rename, re-topic, reorder or re-parent a channel' })
  @ApiOkResponse({ type: ChannelDto })
  update(
    @Member() member: MemberContext,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Body() dto: UpdateChannelDto,
  ): Promise<Channel> {
    return this.channels.update(member, channelId, dto);
  }

  @Delete(':channelId')
  @RequirePermission(Permission.MANAGE_CHANNELS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a channel, and its messages with it' })
  @ApiNoContentResponse()
  remove(
    @Member() member: MemberContext,
    @Param('channelId', ParseUUIDPipe) channelId: string,
  ): Promise<void> {
    return this.channels.remove(member, channelId);
  }
}

/** Channel-level permission overrides. Same resource, different permission. */
@ApiTags('channels')
@ApiBearerAuth()
@Controller('servers/:serverId/channels/:channelId/permissions')
export class ChannelPermissionsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  @RequirePermission(Permission.MANAGE_ROLES)
  @ApiOperation({ summary: 'Every override on this channel' })
  @ApiOkResponse({ type: [ChannelOverrideDto] })
  list(
    @Member() member: MemberContext,
    @Param('channelId', ParseUUIDPipe) channelId: string,
  ): Promise<ChannelOverride[]> {
    return this.channels.overrides(member, channelId);
  }

  @Put('roles/:roleId')
  @RequirePermission(Permission.MANAGE_ROLES)
  @ApiOperation({ summary: 'Set a role’s override here — all-neutral removes it' })
  @ApiOkResponse({ type: [ChannelOverrideDto] })
  setRole(
    @Member() member: MemberContext,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: SetOverrideDto,
  ): Promise<ChannelOverride[]> {
    return this.channels.setRoleOverride(member, channelId, roleId, dto);
  }

  @Put('members/:userId')
  @RequirePermission(Permission.MANAGE_ROLES)
  @ApiOperation({ summary: 'Set one member’s override here — all-neutral removes it' })
  @ApiOkResponse({ type: [ChannelOverrideDto] })
  setMember(
    @Member() member: MemberContext,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SetOverrideDto,
  ): Promise<ChannelOverride[]> {
    return this.channels.setMemberOverride(member, channelId, userId, dto);
  }
}
