import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { ErrorLogEntry } from '@nestcord/shared';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.service';
import { ErrorLogService } from '../common/errors/error-log.service';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminAccessDto, ErrorLogEntryDto, ListErrorLogDto } from './dto/error-log.dto';

/**
 * The admin error log. These are the only routes in the app that return a stack
 * trace, which is why every one of them is behind AdminGuard.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly errorLog: ErrorLogService,
  ) {}

  /**
   * Not guarded: answering "no" is the point. The web app asks this to decide
   * whether to show the link, and a plain `false` is a better answer than a 403 it
   * would have to catch.
   */
  @Get('access')
  @ApiOperation({ summary: 'Whether you may read the error log' })
  @ApiOkResponse({ type: AdminAccessDto })
  async access(@CurrentUser() user: RequestUser): Promise<AdminAccessDto> {
    return { isAdmin: await this.admin.isAdmin(user.id) };
  }

  @Get('errors')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'The error log, newest first' })
  @ApiOkResponse({ type: [ErrorLogEntryDto] })
  @ApiForbiddenResponse({ description: 'Not an admin' })
  list(@Query() query: ListErrorLogDto): Promise<ErrorLogEntry[]> {
    return this.errorLog.list(query.before);
  }

  /**
   * Looked up by the reference the user quoted, because that is the only part of
   * the failure they ever saw.
   */
  @Get('errors/:reference')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'One error by the reference a user reported' })
  @ApiOkResponse({ type: ErrorLogEntryDto })
  @ApiNotFoundResponse({ description: 'No error carries that reference' })
  @ApiForbiddenResponse({ description: 'Not an admin' })
  async find(@Param('reference') reference: string): Promise<ErrorLogEntry> {
    const entry = await this.errorLog.findByReference(reference.trim().toUpperCase());

    if (entry === null) throw new NotFoundException('No error with that reference');

    return entry;
  }
}
