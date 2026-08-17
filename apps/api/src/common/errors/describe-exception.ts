import { HttpException, HttpStatus } from '@nestjs/common';

import { Prisma } from '@nestcord/database';
import { GENERIC_ERROR_MESSAGE } from '@nestcord/shared';

/** What the filter needs to decide on before it can answer or log anything. */
export interface DescribedException {
  status: number;
  /** Safe to show a user, always. Never a stack, a SQL fragment or a table name. */
  message: string;
  /**
   * The real cause, for the error log. Null when there is nothing to record: a
   * validation error or a "you cannot do that" is the system working, and logging
   * every one of them would bury the failures that matter.
   */
  detail: string | null;
}

/**
 * Prisma error codes worth a sentence of their own.
 *
 * Reaching the filter with one of these means a service skipped a check, so they
 * are still recorded — but the user gets an answer they can act on rather than an
 * apology. Anything not listed here is a bug we cannot summarise, and falls
 * through to the generic 500.
 */
const PRISMA_MESSAGES: Record<string, { status: number; message: string }> = {
  // Unique constraint. The field name is deliberately left out: it is a column
  // name, and the routes that expect this collision word it properly themselves.
  P2002: { status: HttpStatus.CONFLICT, message: 'That already exists. Try a different value.' },
  // Record not found for an update or delete.
  P2025: { status: HttpStatus.NOT_FOUND, message: 'That no longer exists.' },
  // Foreign key constraint.
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    message: 'That refers to something that no longer exists.',
  },
  // Value too long for the column.
  P2000: { status: HttpStatus.BAD_REQUEST, message: 'That value is too long.' },
};

/**
 * Turn anything a handler threw into a status, a sentence a user can read, and
 * the detail that belongs in the log instead of in the response.
 *
 * Pure on purpose: this is the whole decision about what users are told, so it is
 * worth testing without a request, a response or a database.
 */
export function describeException(exception: unknown): DescribedException {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const message = readHttpMessage(exception);

    // A 5xx someone threw on purpose is still a failure nobody planned for: the
    // message it carries was written for a developer, not for whoever is waiting.
    return status >= HttpStatus.INTERNAL_SERVER_ERROR
      ? { status, message: GENERIC_ERROR_MESSAGE, detail: message }
      : { status, message, detail: null };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const known = PRISMA_MESSAGES[exception.code];
    const detail = `Prisma ${exception.code}: ${exception.message}`;

    return known === undefined
      ? { status: HttpStatus.INTERNAL_SERVER_ERROR, message: GENERIC_ERROR_MESSAGE, detail }
      : { status: known.status, message: known.message, detail };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: GENERIC_ERROR_MESSAGE,
    detail: exception instanceof Error ? exception.message : String(exception),
  };
}

/**
 * An HttpException's body is a string for `new ForbiddenException('...')` and an
 * object for the ValidationPipe, whose `message` is an array of one line per bad
 * field. Both end up as one sentence.
 */
function readHttpMessage(exception: HttpException): string {
  const response = exception.getResponse();

  if (typeof response === 'string') return response;

  const { message } = response as { message?: string | string[] };

  if (Array.isArray(message)) return message.join(', ');

  return message ?? exception.message;
}
