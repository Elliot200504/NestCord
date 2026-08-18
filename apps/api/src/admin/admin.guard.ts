import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import type { RequestUser } from '../auth/auth.service';
import { AdminService } from './admin.service';

/**
 * Guards the routes that expose raw error detail. Runs after the global
 * JwtAuthGuard, so a missing user here means the route forgot its authentication
 * rather than that the caller is anonymous — either way it is refused.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly admin: AdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const userId = request.user?.id;

    // Deliberately vague: whether an account is an admin is not something a
    // non-admin gets to find out by reading the error message.
    if (userId === undefined || !(await this.admin.isAdmin(userId))) {
      throw new ForbiddenException('You do not have access to this');
    }

    return true;
  }
}
