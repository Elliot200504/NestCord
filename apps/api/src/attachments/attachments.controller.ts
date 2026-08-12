import {
  BadRequestException,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ATTACHMENT_MAX_BYTES, Permission, type MessageAttachment } from '@nestcord/shared';

import type { MemberContext } from '../common/permissions/member-context';
import { Member } from '../common/permissions/member.decorator';
import { PermissionsService } from '../common/permissions/permissions.service';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { MessageAttachmentDto } from '../messages/dto/message.dto';
import { AttachmentsService } from './attachments.service';

const UPLOAD_THROTTLE = { default: { limit: 60, ttl: 60 * 60_000 } };

/**
 * Upload first, then send the returned id with the message (PLAN.MD §9).
 *
 * Nested under the channel it is destined for so ATTACH_FILES can be checked where it
 * actually applies — a channel override that forbids files is checked here, at upload,
 * as well as when the message that carries them is sent.
 */
@ApiTags('messages')
@ApiBearerAuth()
@Controller('servers/:serverId/channels/:channelId/attachments')
export class AttachmentsController {
  constructor(
    private readonly attachments: AttachmentsService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post()
  @RequirePermission(Permission.ATTACH_FILES)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Upload a file to attach to a message in this channel' })
  @ApiOkResponse({ type: MessageAttachmentDto })
  async upload(
    @Member() member: MemberContext,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MessageAttachment> {
    if (!file) throw new BadRequestException('No file was uploaded');

    await this.permissions.requireChannelPermission(member, channelId, Permission.ATTACH_FILES);

    return this.attachments.upload(member.userId, file);
  }
}
