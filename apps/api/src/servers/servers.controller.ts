import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  Permission,
  SERVER_ICON_MAX_BYTES,
  type Server,
  type ServerSummary,
} from '@nestcord/shared';

import type { RequestUser } from '../auth/auth.service';
import { CurrentUser as User } from '../auth/decorators/current-user.decorator';
import type { MemberContext } from '../common/permissions/member-context';
import { Member } from '../common/permissions/member.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { CreateServerDto } from './dto/create-server.dto';
import { ServerDto, ServerSummaryDto } from './dto/server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { ServersService } from './servers.service';

/** Creating servers is cheap for us and spammy in the rail, so it is capped. */
const CREATE_THROTTLE = { default: { limit: 10, ttl: 60 * 60_000 } };
const UPLOAD_THROTTLE = { default: { limit: 10, ttl: 60 * 60_000 } };

@ApiTags('servers')
@ApiBearerAuth()
@Controller('servers')
export class ServersController {
  constructor(private readonly servers: ServersService) {}

  @Get()
  @ApiOperation({ summary: 'Every server you are a member of' })
  @ApiOkResponse({ type: [ServerSummaryDto] })
  listMine(@User() user: RequestUser): Promise<ServerSummary[]> {
    return this.servers.listMine(user.id);
  }

  @Throttle(CREATE_THROTTLE)
  @Post()
  @ApiOperation({ summary: 'Create a server, its @everyone role and a #general channel' })
  @ApiOkResponse({ type: ServerDto })
  create(@User() user: RequestUser, @Body() dto: CreateServerDto): Promise<Server> {
    return this.servers.create(user.id, dto.name);
  }

  @Get(':serverId')
  @RequirePermission()
  @ApiOperation({ summary: 'One server, with its roles and your own permissions' })
  @ApiOkResponse({ type: ServerDto })
  findOne(@Member() member: MemberContext): Promise<Server> {
    return this.servers.findOne(member.serverId, member.permissions);
  }

  @Patch(':serverId')
  @RequirePermission(Permission.MANAGE_SERVER)
  @ApiOperation({ summary: 'Rename a server' })
  @ApiOkResponse({ type: ServerDto })
  update(@Member() member: MemberContext, @Body() dto: UpdateServerDto): Promise<Server> {
    return this.servers.update(member, dto);
  }

  @Throttle(UPLOAD_THROTTLE)
  @Post(':serverId/icon')
  @RequirePermission(Permission.MANAGE_SERVER)
  // Kept in memory so nothing untrusted touches the disk until it has been
  // checked; the size limit is what stops that being a way to exhaust memory.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: SERVER_ICON_MAX_BYTES, files: 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Upload a server icon' })
  @ApiOkResponse({ type: ServerDto })
  uploadIcon(
    @Member() member: MemberContext,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<Server> {
    if (!file) throw new BadRequestException('No file was uploaded');

    return this.servers.setIcon(member, file);
  }

  @Delete(':serverId/icon')
  @RequirePermission(Permission.MANAGE_SERVER)
  @ApiOperation({ summary: 'Go back to the generated server icon' })
  @ApiOkResponse({ type: ServerDto })
  removeIcon(@Member() member: MemberContext): Promise<Server> {
    return this.servers.removeIcon(member);
  }

  @Delete(':serverId')
  @RequirePermission()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a server — owner only' })
  @ApiNoContentResponse()
  remove(@Member() member: MemberContext): Promise<void> {
    return this.servers.remove(member);
  }
}
