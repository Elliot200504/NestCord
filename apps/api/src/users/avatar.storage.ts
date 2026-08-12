import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ImageStorage, imageUrlPrefix } from '../common/storage/image.storage';
import type { Env } from '../config/env';

/** Where avatars live under UPLOAD_DIR, and the URL prefix they are served from. */
export const AVATAR_SUBDIRECTORY = 'avatars';
export const AVATAR_URL_PREFIX = imageUrlPrefix(AVATAR_SUBDIRECTORY);

/** Avatar files. All the behavior is in `ImageStorage`; this only picks the folder. */
@Injectable()
export class AvatarStorage extends ImageStorage {
  constructor(config: ConfigService<Env, true>) {
    super(config.get('UPLOAD_DIR', { infer: true }), AVATAR_SUBDIRECTORY);
  }
}
