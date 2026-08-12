import { IMAGE_MIME_TYPES } from '@nestcord/shared';

import { FileStorage, fileUrlPrefix } from './file.storage';

/** Kept for the call sites that only ever store images. */
export const imageUrlPrefix = fileUrlPrefix;

/**
 * Images on local disk: avatars and server icons.
 *
 * Nothing but the four image formats gets through, so an avatar cannot be a PDF that
 * the attachment storage would have accepted.
 */
export class ImageStorage extends FileStorage {
  constructor(uploadDir: string, subdirectory: string) {
    super(
      uploadDir,
      subdirectory,
      IMAGE_MIME_TYPES,
      'That file is not a PNG, JPEG, GIF or WEBP image',
    );
  }

  /** Only the URL matters for an image: it is the whole of what the row stores. */
  async save(file: Express.Multer.File): Promise<string> {
    const stored = await this.store(file);

    return stored.url;
  }
}
