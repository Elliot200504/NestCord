import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { PublicUser } from '@nestcord/shared';

import type { Env } from '../../config/env';
import { type AccessTokenPayload, AuthService } from '../auth.service';

/**
 * Verifies the bearer access token, then confirms the session behind it still
 * exists. Skipping that second step would leave logged-out access tokens working
 * until they expired.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<PublicUser> {
    return this.auth.findSessionUser(payload);
  }
}
