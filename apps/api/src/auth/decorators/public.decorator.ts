import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'nestcord:isPublic';

/**
 * Opt a route out of the global authentication guard. Authentication is on by
 * default so that forgetting a guard fails closed rather than open.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
