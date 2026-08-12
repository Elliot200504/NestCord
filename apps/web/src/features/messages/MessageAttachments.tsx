import { FileText } from 'lucide-react';

import type { MessageAttachment } from '@nestcord/shared';

/** Bytes as something readable: `284 KB`, not `290816`. */
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB'];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  return `${size < 10 && unit > 0 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

/**
 * Images show themselves; anything else is a link with its name and size.
 *
 * The image is capped rather than scaled to fit, so a screenshot stays readable
 * without a tall image pushing the rest of the conversation off screen.
 */
export function MessageAttachments({ attachments }: { attachments: MessageAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <ul className="mt-1.5 flex flex-col gap-1.5">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          {attachment.mimeType.startsWith('image/') ? (
            <a href={attachment.url} target="_blank" rel="noreferrer">
              <img
                src={attachment.url}
                alt={attachment.filename}
                className="border-border max-h-80 max-w-full rounded-lg border object-contain"
              />
            </a>
          ) : (
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="bg-surface-800 border-border hover:border-primary/60 inline-flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors"
            >
              <FileText className="text-content-300 size-5 shrink-0" aria-hidden />
              <span className="min-w-0">
                <span className="text-primary block truncate text-sm">{attachment.filename}</span>
                <span className="text-content-500 block text-xs">
                  {formatSize(attachment.size)}
                </span>
              </span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
