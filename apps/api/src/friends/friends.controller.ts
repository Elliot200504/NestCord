import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { Friend } from '@nestcord/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.service';
import { FriendDto } from './dto/friend.dto';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { FriendsService } from './friends.service';

/**
 * Unsolicited requests are the spam surface here, so sending is limited well below
 * the global allowance (PLAN.MD §23).
 */
const REQUEST_THROTTLE = { default: { limit: 20, ttl: 60 * 60_000 } };

/**
 * Your own relationships only. Every route acts on the pair (you, :userId), so the
 * token is the authorization — there is no id here that could belong to someone else.
 */
@ApiTags('friends')
@ApiBearerAuth()
@Controller('friends')
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  @ApiOperation({ summary: 'Your friends, pending requests, and the people you have blocked' })
  @ApiOkResponse({ type: [FriendDto] })
  list(@CurrentUser() user: RequestUser): Promise<Friend[]> {
    return this.friends.list(user.id);
  }

  @Throttle(REQUEST_THROTTLE)
  @Post()
  @ApiOperation({ summary: 'Send a friend request by username' })
  @ApiOkResponse({ type: FriendDto })
  @ApiNotFoundResponse({ description: 'No user by that name' })
  @ApiConflictResponse({ description: 'Already friends, or already asked' })
  @ApiForbiddenResponse({ description: 'Blocked' })
  send(@CurrentUser() user: RequestUser, @Body() dto: SendFriendRequestDto): Promise<Friend> {
    return this.friends.sendRequest(user.id, dto.username);
  }

  @Post(':userId/accept')
  @ApiOperation({ summary: 'Accept a request someone sent you' })
  @ApiOkResponse({ type: FriendDto })
  @ApiNotFoundResponse({ description: 'No pending request from that user' })
  accept(
    @CurrentUser() user: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<Friend> {
    return this.friends.accept(user.id, userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reject a request, withdraw yours, or remove a friend' })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.friends.remove(user.id, userId);
  }

  @Post(':userId/block')
  @ApiOperation({ summary: 'Block a user, replacing any friendship or request' })
  @ApiOkResponse({ type: FriendDto })
  block(
    @CurrentUser() user: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<Friend> {
    return this.friends.block(user.id, userId);
  }

  @Delete(':userId/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Lift a block you placed' })
  @ApiNoContentResponse()
  unblock(
    @CurrentUser() user: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.friends.unblock(user.id, userId);
  }
}
