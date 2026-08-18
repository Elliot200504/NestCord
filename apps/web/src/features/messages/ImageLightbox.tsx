import type { KeyboardEvent } from 'react';
import { Dialog } from 'radix-ui';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';

import type { MessageAttachment } from '@nestcord/shared';

import { DIALOG_MOTION, OVERLAY_MOTION } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  /** The gallery being browsed: the images on one message. */
  images: MessageAttachment[];
  /** Which one is showing, or null when the lightbox is closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * An image opened at full size over the app, rather than in a new tab that loses the
 * conversation (PLAN.MD §15).
 *
 * Built on the Radix dialog primitives directly rather than the shared `DialogContent`
 * card: a lightbox wants the viewport and no chrome, which is the opposite of what that
 * card is for. Radix still gives the focus trap, the escape key and the aria wiring.
 *
 * Several images on one message browse as a gallery, with the arrow keys as well as the
 * buttons. It wraps around, so the arrows never dead-end.
 */
export function ImageLightbox({ images, index, onIndexChange, onClose }: ImageLightboxProps) {
  const current = index === null ? undefined : images[index];

  if (index === null || !current) return null;

  const step = (by: number) => onIndexChange((index + by + images.length) % images.length);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (images.length < 2) return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn('fixed inset-0 z-50 bg-black/80', OVERLAY_MOTION)} />

        <Dialog.Content
          onKeyDown={handleKeyDown}
          className={cn(
            'fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-4 outline-none sm:p-8',
            DIALOG_MOTION,
          )}
        >
          {/* The dialog needs a name, and the filename is the honest one. Visually it
              is already in the caption below, so it is not repeated on screen. */}
          <Dialog.Title className="sr-only">{current.filename}</Dialog.Title>

          <div className="flex min-h-0 w-full flex-1 items-center justify-center gap-2">
            {images.length > 1 && (
              <LightboxButton label="Previous image" onClick={() => step(-1)}>
                <ChevronLeft className="size-6" aria-hidden />
              </LightboxButton>
            )}

            <img
              src={current.url}
              alt={current.filename}
              className="max-h-full min-h-0 rounded-lg object-contain"
            />

            {images.length > 1 && (
              <LightboxButton label="Next image" onClick={() => step(1)}>
                <ChevronRight className="size-6" aria-hidden />
              </LightboxButton>
            )}
          </div>

          <figcaption className="text-content-300 flex shrink-0 items-center gap-3 text-xs">
            <span className="max-w-60 truncate">{current.filename}</span>
            {images.length > 1 && (
              <span className="text-content-500 tabular-nums">
                {index + 1} of {images.length}
              </span>
            )}
            <a
              href={current.url}
              target="_blank"
              rel="noreferrer"
              className="hover:text-content-100 flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Open original
            </a>
          </figcaption>

          <Dialog.Close
            aria-label="Close"
            className="text-content-300 hover:bg-surface-700 hover:text-content-100 absolute top-4 right-4 rounded-lg p-2 transition-colors"
          >
            <X className="size-5" aria-hidden />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function LightboxButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-content-300 hover:bg-surface-700/80 hover:text-content-100 shrink-0 rounded-full p-2 transition-colors"
    >
      {children}
    </button>
  );
}
