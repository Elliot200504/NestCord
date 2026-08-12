import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ImageStorage, imageUrlPrefix } from '../common/storage/image.storage';
import type { Env } from '../config/env';

/** Where server icons live under UPLOAD_DIR, kept apart from avatars. */
export const SERVER_ICON_SUBDIRECTORY = 'icons';
export const SERVER_ICON_URL_PREFIX = imageUrlPrefix(SERVER_ICON_SUBDIRECTORY);

/** Server icon files. All the behavior is in `ImageStorage`. */
@Injectable()
export class ServerIconStorage extends ImageStorage {
  constructor(config: ConfigService<Env, true>) {
    super(config.get('UPLOAD_DIR', { infer: true }), SERVER_ICON_SUBDIRECTORY);
  }
}
