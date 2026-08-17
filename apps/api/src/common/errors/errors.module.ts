import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { AllExceptionsFilter } from './all-exceptions.filter';
import { ErrorLogService } from './error-log.service';

/**
 * Registers the global exception filter through the module system rather than
 * `app.useGlobalFilters()` in main.ts, because the filter injects ErrorLogService
 * and so needs the container.
 *
 * Exports the service too: the admin routes read the log it writes.
 */
@Module({
  providers: [ErrorLogService, { provide: APP_FILTER, useClass: AllExceptionsFilter }],
  exports: [ErrorLogService],
})
export class ErrorsModule {}
