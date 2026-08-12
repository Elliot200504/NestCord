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

import { Permission, type ServerRole } from '@nestcord/shared';

import type { MemberContext } from '../common/permissions/member-context';
import { Member } from '../common/permissions/member.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { ServerRoleDto } from '../servers/dto/server.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('servers/:serverId/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  // Membership only: the client needs the role list to render names and colours.
  @RequirePermission()
  @ApiOperation({ summary: 'Roles in this server, highest first' })
  @ApiOkResponse({ type: [ServerRoleDto] })
  list(@Member() member: MemberContext): Promise<ServerRole[]> {
    return this.roles.list(member.serverId);
  }

  @Post()
  @RequirePermission(Permission.MANAGE_ROLES)
  @ApiOperation({ summary: 'Create a role just above @everyone' })
  @ApiOkResponse({ type: ServerRoleDto })
  create(@Member() member: MemberContext, @Body() dto: CreateRoleDto): Promise<ServerRole> {
    return this.roles.create(member, dto);
  }

  @Patch(':roleId')
  @RequirePermission(Permission.MANAGE_ROLES)
  @ApiOperation({ summary: 'Edit a role below your own highest' })
  @ApiOkResponse({ type: ServerRoleDto })
  update(
    @Member() member: MemberContext,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<ServerRole> {
    return this.roles.update(member, roleId, dto);
  }

  @Delete(':roleId')
  @RequirePermission(Permission.MANAGE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role' })
  @ApiNoContentResponse()
  remove(
    @Member() member: MemberContext,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<void> {
    return this.roles.remove(member, roleId);
  }
}

/** Assigning roles to a member. Same permission, different resource. */
@ApiTags('roles')
@ApiBearerAuth()
@Controller('servers/:serverId/members/:userId/roles')
export class MemberRolesController {
  constructor(private readonly roles: RolesService) {}

  @Put(':roleId')
  @RequirePermission(Permission.MANAGE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Give a member a role' })
  @ApiNoContentResponse()
  assign(
    @Member() member: MemberContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<void> {
    return this.roles.assign(member, userId, roleId);
  }

  @Delete(':roleId')
  @RequirePermission(Permission.MANAGE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Take a role away from a member' })
  @ApiNoContentResponse()
  unassign(
    @Member() member: MemberContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<void> {
    return this.roles.unassign(member, userId, roleId);
  }
}
