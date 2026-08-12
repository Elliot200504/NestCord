import type { MessageAttachment } from '@nestcord/shared';

/** The columns a `MessageAttachment` is built from — never `uploaderId`. */
export const ATTACHMENT_SELECT = {
  id: true,
  filename: true,
  mimeType: true,
  size: true,
  url: true,
} as const;

/** The one place an attachment row becomes a response body. */
export function toAttachment(attachment: MessageAttachment): MessageAttachment {
  return {
    id: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: attachment.url,
  };
}
