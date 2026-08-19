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
  AVATAR_MAX_BYTES,
  type CurrentUser,
  type UserProfile,
  type UserSession,
} from '@nestcord/shared';

import { CurrentSessionId, CurrentUser as User } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CurrentUserDto, UserProfileDto, UserSessionDto } from './dto/user-profile.dto';
import { UsersService } from './users.service';

/** Guessing at the current password should be as slow as guessing at a login. */
const PASSWORD_THROTTLE = { default: { limit: 5, ttl: 60 * 60_000 } };
const UPLOAD_THROTTLE = { default: { limit: 10, ttl: 60 * 60_000 } };

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Your own profile, including your email' })
  @ApiOkResponse({ type: CurrentUserDto })
  findMe(@User() user: RequestUser): Promise<CurrentUser> {
    return this.users.findCurrent(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update your username, display name, bio or accent colour' })
  @ApiOkResponse({ type: CurrentUserDto })
  updateMe(@User() user: RequestUser, @Body() dto: UpdateProfileDto): Promise<CurrentUser> {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch('me/status')
  @ApiOperation({ summary: 'Set your presence status' })
  @ApiOkResponse({ type: CurrentUserDto })
  updateStatus(@User() user: RequestUser, @Body() dto: UpdateStatusDto): Promise<CurrentUser> {
    return this.users.updateStatus(user.id, dto.status);
  }

  @Throttle(PASSWORD_THROTTLE)
  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change your password and sign your other devices out' })
  @ApiNoContentResponse()
  changePassword(
    @User() user: RequestUser,
    @CurrentSessionId() sessionId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.users.changePassword(user.id, sessionId, dto);
  }

  @Throttle(UPLOAD_THROTTLE)
  @Post('me/avatar')
  // Kept in memory so nothing untrusted touches the disk until it has been
  // checked; the size limit is what stops that being a way to exhaust memory.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Upload a new avatar' })
  @ApiOkResponse({ type: CurrentUserDto })
  uploadAvatar(
    @User() user: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<CurrentUser> {
    if (!file) throw new BadRequestException('No file was uploaded');

    return this.users.setAvatar(user.id, file);
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Go back to the generated avatar' })
  @ApiOkResponse({ type: CurrentUserDto })
  removeAvatar(@User() user: RequestUser): Promise<CurrentUser> {
    return this.users.removeAvatar(user.id);
  }

  @Get('me/sessions')
  @ApiOperation({ summary: 'Devices currently signed in to your account' })
  @ApiOkResponse({ type: [UserSessionDto] })
  listSessions(
    @User() user: RequestUser,
    @CurrentSessionId() sessionId: string,
  ): Promise<UserSession[]> {
    return this.users.listSessions(user.id, sessionId);
  }

  @Delete('me/sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out every device except this one' })
  @ApiNoContentResponse()
  async revokeOtherSessions(
    @User() user: RequestUser,
    @CurrentSessionId() sessionId: string,
  ): Promise<void> {
    await this.users.revokeOtherSessions(user.id, sessionId);
  }

  @Delete('me/sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out one other device' })
  @ApiNoContentResponse()
  revokeSession(
    @User() user: RequestUser,
    @CurrentSessionId() currentSessionId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    return this.users.revokeSession(user.id, sessionId, currentSessionId);
  }

  // Last: a literal path segment would otherwise be captured by :userId.
  @Get(':userId')
  @ApiOperation({ summary: "Another user's profile card" })
  @ApiOkResponse({ type: UserProfileDto })
  findOne(@Param('userId', ParseUUIDPipe) userId: string): Promise<UserProfile> {
    return this.users.findProfile(userId);
  }
}
