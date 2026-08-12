import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { NotificationPayload } from '@nestcord/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.service';
import { NotificationDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

/**
 * Your own notifications only — there is no route that reads anyone else's, so there
 * is no id to authorize beyond the token.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Your unread notifications, newest first' })
  @ApiOkResponse({ type: [NotificationDto] })
  list(@CurrentUser() user: RequestUser): Promise<NotificationPayload[]> {
    return this.notifications.list(user.id);
  }

  @Post('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark everything read' })
  @ApiNoContentResponse()
  readAll(@CurrentUser() user: RequestUser): Promise<void> {
    return this.notifications.markRead(user.id);
  }

  @Post(':notificationId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one read' })
  @ApiNoContentResponse()
  read(
    @CurrentUser() user: RequestUser,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ): Promise<void> {
    return this.notifications.markRead(user.id, notificationId);
  }
}
