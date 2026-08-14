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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Permission, type Message, type MessageReaction, type Paginated } from '@nestcord/shared';

import type { MemberContext } from '../common/permissions/member-context';
import { Member } from '../common/permissions/member.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { MessageDto, MessagePageDto, MessageReactionDto } from './dto/message.dto';
import { requireEmoji } from './message-reactions';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessagesService } from './messages.service';

/** Fast enough to hold a conversation, slow enough not to flood a channel. */
const SEND_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

/**
 * Nested under `/servers/:serverId` so `ServerPermissionGuard` has a server to
 * resolve the caller against. The per-channel permission — which an override can take
 * away — is then checked inside the service, where the channel's overrides are known.
 */
@ApiTags('messages')
@ApiBearerAuth()
@Controller('servers/:serverId/channels/:channelId/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  // Membership only here: VIEW_CHANNEL for this channel is checked in the service.
  @RequirePermission()
  @ApiOperation({ summary: 'One page of channel history, newest first' })
  @ApiOkResponse({ type: MessagePageDto })
  list(
    @Member() member: MemberContext,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Query() query: ListMessagesDto,
  ): Promise<Paginated<Message>> {
    return this.messages.list(member, channelId, query);
  }

  @Post()
  @RequirePermission(Permission.SEND_MESSAGES)
  @Throttle(SEND_THROTTLE)
  @ApiOperation({ summary: 'Send a message, optionally as a reply or with attachments' })
  @ApiOkResponse({ type: MessageDto })
  create(
    @Member() member: MemberContext,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Body() dto: CreateMessageDto,
  ): Promise<Message> {
    return this.messages.create(member, channelId, dto);
  }

  @Patch(':messageId')
  @RequirePermission()
  @ApiOperation({ summary: 'Edit your own message' })
  @ApiOkResponse({ type: MessageDto })
  update(
    @Member() member: MemberContext,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: UpdateMessageDto,
  ): Promise<Message> {
    return this.messages.update(member, channelId, messageId, dto);
  }

  @Delete(':messageId')
  @RequirePermission()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete your own message, or anyone’s with Manage Messages' })
  @ApiNoContentResponse()
  remove(
    @Member() member: MemberContext,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<void> {
    return this.messages.remove(member, channelId, messageId);
  }
}

/**
 * Reactions are addressed by the emoji itself, so adding one is idempotent and needs
 * no id round trip: the client already knows which emoji it clicked.
 */
@ApiTags('messages')
@ApiBearerAuth()
@Controller('servers/:serverId/channels/:channelId/messages/:messageId/reactions')
export class ReactionsController {
  constructor(private readonly messages: MessagesService) {}

  @Put(':emoji')
  @RequirePermission(Permission.ADD_REACTIONS)
  @ApiOperation({ summary: 'Add your reaction — reacting twice changes nothing' })
  @ApiParam({ name: 'emoji', example: '👍', description: 'URL-encoded' })
  @ApiOkResponse({ type: [MessageReactionDto] })
  add(
    @Member() member: MemberContext,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Param('emoji') emoji: string,
  ): Promise<MessageReaction[]> {
    return this.messages.addReaction(member, channelId, messageId, requireEmoji(emoji));
  }

  @Delete(':emoji')
  @RequirePermission()
  @ApiOperation({ summary: 'Take your own reaction back' })
  @ApiParam({ name: 'emoji', example: '👍', description: 'URL-encoded' })
  @ApiOkResponse({ type: [MessageReactionDto] })
  remove(
    @Member() member: MemberContext,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Param('emoji') emoji: string,
  ): Promise<MessageReaction[]> {
    return this.messages.removeReaction(member, channelId, messageId, requireEmoji(emoji));
  }
}
