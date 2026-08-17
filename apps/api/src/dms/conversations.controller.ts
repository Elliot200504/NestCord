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
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { Conversation } from '@nestcord/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.service';
import { ConversationsService } from './conversations.service';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { ConversationDto } from './dto/conversation.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

/** Opening conversations is how you reach someone unsolicited, so it is limited like a friend request. */
const OPEN_THROTTLE = { default: { limit: 30, ttl: 60 * 60_000 } };

/**
 * Your own conversations only. There is no server in the path and no permission
 * guard: participation is the authorization, and the service proves it on every
 * route — an id you are not part of answers 404, not 403.
 */
@ApiTags('dms')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'Your DMs and group DMs, most recently active first' })
  @ApiOkResponse({ type: [ConversationDto] })
  list(@CurrentUser() user: RequestUser): Promise<Conversation[]> {
    return this.conversations.list(user.id);
  }

  @Post()
  @Throttle(OPEN_THROTTLE)
  @ApiOperation({ summary: 'Open a DM with one person, or a group with several' })
  @ApiOkResponse({ type: ConversationDto })
  @ApiForbiddenResponse({ description: 'A block stands between you and one of them' })
  @ApiNotFoundResponse({ description: 'No such user' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateConversationDto,
  ): Promise<Conversation> {
    return this.conversations.create(user.id, dto);
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'One conversation you are in' })
  @ApiOkResponse({ type: ConversationDto })
  @ApiNotFoundResponse({ description: 'No such conversation, or you are not in it' })
  find(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ): Promise<Conversation> {
    return this.conversations.find(user.id, conversationId);
  }

  @Patch(':conversationId')
  @ApiOperation({ summary: 'Rename a group DM, or clear its name' })
  @ApiOkResponse({ type: ConversationDto })
  @ApiBadRequestResponse({ description: 'A one-to-one DM cannot be renamed' })
  rename(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: UpdateConversationDto,
  ): Promise<Conversation> {
    return this.conversations.rename(user.id, conversationId, dto);
  }

  @Post(':conversationId/participants')
  @Throttle(OPEN_THROTTLE)
  @ApiOperation({ summary: 'Add people to a group DM' })
  @ApiOkResponse({ type: ConversationDto })
  @ApiBadRequestResponse({ description: 'Not a group, or it would be too big' })
  addParticipants(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: AddParticipantsDto,
  ): Promise<Conversation> {
    return this.conversations.addParticipants(user.id, conversationId, dto);
  }

  @Delete(':conversationId/participants/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a group DM' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'A one-to-one DM cannot be left' })
  leave(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ): Promise<void> {
    return this.conversations.leave(user.id, conversationId);
  }
}
