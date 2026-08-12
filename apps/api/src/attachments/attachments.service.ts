import { BadRequestException, Injectable } from '@nestjs/common';

import { MESSAGE_MAX_ATTACHMENTS, type MessageAttachment } from '@nestcord/shared';

import { PrismaService } from '../common/prisma/prisma.service';
import { ATTACHMENT_SELECT, toAttachment } from './attachment-response';
import { AttachmentStorage } from './attachment.storage';

/** The uploader's filename is shown, never used as a path — so only display matters. */
const FILENAME_MAX_LENGTH = 120;

/**
 * Message attachments (PLAN.MD §9): bytes on local disk, metadata in PostgreSQL.
 *
 * Uploading and sending are two steps. The file is stored first and returned with an
 * id, then the id is passed to the message it belongs to. That keeps a multipart body
 * out of the message route, and it means a failed upload never leaves a half-written
 * message behind — only an unclaimed row, which nothing renders.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: AttachmentStorage,
  ) {}

  /** Stores the file and records it as unclaimed, waiting for a message to own it. */
  async upload(uploaderId: string, file: Express.Multer.File): Promise<MessageAttachment> {
    const stored = await this.storage.store(file);

    const attachment = await this.prisma.client.attachment.create({
      data: {
        uploaderId,
        filename: displayFilename(file.originalname),
        mimeType: stored.mimeType,
        size: stored.size,
        url: stored.url,
      },
      select: ATTACHMENT_SELECT,
    });

    return toAttachment(attachment);
  }

  /**
   * Checks that every id is one of this user's own uploads and is not already on a
   * message, which is what stops someone attaching another person's file — or
   * re-attaching one to make a second message point at it.
   */
  async requireClaimable(uploaderId: string, attachmentIds: string[]): Promise<void> {
    if (attachmentIds.length === 0) return;

    if (attachmentIds.length > MESSAGE_MAX_ATTACHMENTS) {
      throw new BadRequestException(`A message takes at most ${MESSAGE_MAX_ATTACHMENTS} files`);
    }

    const claimable = await this.prisma.client.attachment.count({
      where: { id: { in: attachmentIds }, uploaderId, messageId: null },
    });

    if (claimable !== attachmentIds.length) {
      throw new BadRequestException('Those attachments are not yours to attach, or already sent');
    }
  }

  /**
   * Deletes the files behind a message that is going away. The rows go with the
   * message by cascade; the bytes on disk are ours to clean up.
   */
  async removeFiles(urls: string[]): Promise<void> {
    await Promise.all(urls.map((url) => this.storage.remove(url)));
  }
}

/**
 * The uploader's filename, trimmed to something displayable. It is never used to
 * build a path — the file on disk was already given a generated name — so this only
 * has to stop a pathological name from breaking the layout.
 */
function displayFilename(originalname: string | undefined): string {
  const name = (originalname ?? '').trim().replaceAll(/[\r\n\t]/g, ' ');

  return name.slice(0, FILENAME_MAX_LENGTH) || 'file';
}
