import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Socket } from 'socket.io';

import type { ApiErrorBody } from '@nestcord/shared';

import type { RequestUser } from '../../auth/auth.service';
import { describeException } from './describe-exception';
import { ErrorLogService } from './error-log.service';

/**
 * The one place an exception becomes a response.
 *
 * Registered globally, so nothing can reach a client unfiltered. Two rules:
 * a user is never shown a technical message, and a message a user cannot act on
 * always comes with a reference code that finds the real cause in the error log.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly errorLog: ErrorLogService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const described = describeException(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;

    if (host.getType() !== 'http') {
      await this.handleSocket(exception, host, stack);
      return;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<Request & { user?: RequestUser }>();

    const reference =
      described.detail === null
        ? undefined
        : await this.errorLog.record({
            statusCode: described.status,
            detail: described.detail,
            stack,
            method: request.method,
            path: request.originalUrl,
            userId: request.user?.id ?? null,
          });

    const body: ApiErrorBody = {
      statusCode: described.status,
      message: described.message,
      // Only shown when the message itself explains nothing. A 4xx already told
      // the user what to change; a code beside it would just look like a fault.
      ...(described.status >= HttpStatus.INTERNAL_SERVER_ERROR && reference !== undefined
        ? { reference }
        : {}),
    };

    http.getResponse<Response>().status(described.status).json(body);
  }

  /**
   * Gateway events have no response to write. They still get logged — an error in
   * a socket handler is exactly as invisible as one in a route otherwise — and the
   * client gets the same `exception` event Nest's default filter would emit, so a
   * failed event does not simply hang.
   */
  private async handleSocket(
    exception: unknown,
    host: ArgumentsHost,
    stack: string | undefined,
  ): Promise<void> {
    const described = describeException(exception);
    const socket = host.switchToWs().getClient<Socket>();

    const reference =
      described.detail === null
        ? undefined
        : await this.errorLog.record({
            statusCode: described.status,
            detail: described.detail,
            stack,
            method: 'WS',
            // The gateway keeps its socket-to-user map privately and the ws context
            // carries no event name, so a socket failure is logged by its socket id
            // and its stack. Both are enough to find the handler.
            path: `socket ${socket.id}`,
          });

    socket.emit('exception', {
      status: 'error',
      message: described.message,
      ...(reference === undefined ? {} : { reference }),
    });
  }
}
