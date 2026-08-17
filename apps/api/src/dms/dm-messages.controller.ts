import {
  BadRequestException,
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
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  ATTACHMENT_MAX_BYTES,
  type Message,
  type MessageAttachment,
  type MessageReaction,
  type Paginated,
} from '@nestcord/shared';

import { AttachmentsService } from '../attachments/attachments.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { ListMessagesDto } from '../messages/dto/list-messages.dto';
import {
  MessageAttachmentDto,
  MessageDto,
  MessagePageDto,
  MessageReactionDto,
} from '../messages/dto/message.dto';
import { UpdateMessageDto } from '../messages/dto/update-message.dto';
import { requireEmoji } from '../messages/message-reactions';
import { ConversationsService } from './conversations.service';
import { DmMessagesService } from './dm-messages.service';

/** The same allowance a channel gets — a DM is a conversation, not a firehose. */
const SEND_THROTTLE = { default: { limit: 30, ttl: 60_000 } };
const UPLOAD_THROTTLE = { default: { limit: 60, ttl: 60 * 60_000 } };

/**
 * The channel message routes with the server path taken off. Same DTOs, same
 * responses, same ordering rules — only the door is different, and the service is
 * where that difference lives.
 */
@ApiTags('dms')
@ApiBearerAuth()
@Controller('conversations/:conversationId/messages')
export class DmMessagesController {
  constructor(private readonly messages: DmMessagesService) {}

  @Get()
  @ApiOperation({ summary: 'One page of DM history, newest first' })
  @ApiOkResponse({ type: MessagePageDto })
  @ApiNotFoundResponse({ description: 'No such conversation, or you are not in it' })
  list(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: ListMessagesDto,
  ): Promise<Paginated<Message>> {
    return this.messages.list(user.id, conversationId, query);
  }

  @Post()
  @Throttle(SEND_THROTTLE)
  @ApiOperation({ summary: 'Send a DM, optionally as a reply or with attachments' })
  @ApiOkResponse({ type: MessageDto })
  create(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: CreateMessageDto,
  ): Promise<Message> {
    return this.messages.create(user.id, conversationId, dto);
  }

  @Patch(':messageId')
  @ApiOperation({ summary: 'Edit your own message' })
  @ApiOkResponse({ type: MessageDto })
  update(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: UpdateMessageDto,
  ): Promise<Message> {
    return this.messages.update(user.id, conversationId, messageId, dto);
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete your own message — a DM has no moderator' })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<void> {
    return this.messages.remove(user.id, conversationId, messageId);
  }
}

@ApiTags('dms')
@ApiBearerAuth()
@Controller('conversations/:conversationId/messages/:messageId/reactions')
export class DmReactionsController {
  constructor(private readonly messages: DmMessagesService) {}

  @Put(':emoji')
  @ApiOperation({ summary: 'Add your reaction — reacting twice changes nothing' })
  @ApiParam({ name: 'emoji', example: '👍', description: 'URL-encoded' })
  @ApiOkResponse({ type: [MessageReactionDto] })
  add(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Param('emoji') emoji: string,
  ): Promise<MessageReaction[]> {
    return this.messages.addReaction(user.id, conversationId, messageId, requireEmoji(emoji));
  }

  @Delete(':emoji')
  @ApiOperation({ summary: 'Take your own reaction back' })
  @ApiParam({ name: 'emoji', example: '👍', description: 'URL-encoded' })
  @ApiOkResponse({ type: [MessageReactionDto] })
  remove(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Param('emoji') emoji: string,
  ): Promise<MessageReaction[]> {
    return this.messages.removeReaction(user.id, conversationId, messageId, requireEmoji(emoji));
  }
}

/**
 * Upload first, then send the returned id with the message — the same two steps a
 * channel attachment takes (PLAN.MD §9). Being in the conversation is the only
 * permission there is to check, so it is checked here before a byte is stored.
 */
@ApiTags('dms')
@ApiBearerAuth()
@Controller('conversations/:conversationId/attachments')
export class DmAttachmentsController {
  constructor(
    private readonly attachments: AttachmentsService,
    private readonly conversations: ConversationsService,
  ) {}

  @Post()
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Upload a file to attach to a message in this conversation' })
  @ApiOkResponse({ type: MessageAttachmentDto })
  async upload(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MessageAttachment> {
    if (!file) throw new BadRequestException('No file was uploaded');

    await this.conversations.requireParticipant(user.id, conversationId);

    return this.attachments.upload(user.id, file);
  }
}
