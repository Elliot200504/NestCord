import { useRef, type ReactNode } from 'react';
import { Dialog, VisuallyHidden } from 'radix-ui';
import { X } from 'lucide-react';

import { drawerMotion, OVERLAY_MOTION } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface ShellPanelProps {
  /** Which edge the panel is anchored to when it slides in as a drawer. */
  side: 'left' | 'right';
  /** False once the viewport is too narrow for the panel to have its own column. */
  wide: boolean;
  visible: boolean;
  onClose: () => void;
  /** Names the drawer itself, e.g. "Channel list". */
  label: string;
  /** Names the backdrop button, e.g. "Close the channel list". */
  closeLabel: string;
  /** Overrides the default `w-60` drawer width, for a panel that carries more than one column. */
  drawerWidth?: string;
  children: ReactNode;
}

/**
 * A side panel of the app shell: a fixed column on a wide viewport, a dismissable
 * overlay on a narrow one (PLAN.MD §14, "make the UI responsive").
 *
 * Both side panels behave identically here, so the column/drawer decision lives in
 * one place rather than being re-derived — and wrongly — in each of them.
 *
 * As a drawer it is a real modal, built on Radix rather than by hand: opening it
 * moves focus inside, Tab cannot wander onto the content it is covering, Escape
 * dismisses it, and closing hands focus back to the button that opened it. A column
 * gets none of that, because it is not covering anything.
 */
export function ShellPanel({
  side,
  wide,
  visible,
  onClose,
  label,
  closeLabel,
  drawerWidth = 'w-60',
  children,
}: ShellPanelProps) {
  // Radix returns focus to a <Dialog.Trigger>, and the buttons that raise these
  // drawers sit in the headers rather than in here — so without this, closing one
  // would drop focus on the body and a keyboard reader would start again from the top.
  const opener = useRef<HTMLElement | null>(null);

  if (wide) {
    if (!visible) return null;

    return <div className="bg-surface-800 flex w-60 shrink-0 flex-col">{children}</div>;
  }

  return (
    <Dialog.Root
      open={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        {/* Tapping the dimmed strip beside the drawer closes it — Radix treats that as
            a dismiss. It stays a plain overlay rather than a button because a modal
            hides everything outside the panel from assistive tech anyway, so a label
            here would never be read; the close button below is the reachable one. */}
        <Dialog.Overlay className={cn('bg-surface-900/70 fixed inset-0 z-40', OVERLAY_MOTION)} />

        <Dialog.Content
          // Read before Radix moves focus inside, so it is still whoever clicked.
          onOpenAutoFocus={() => {
            opener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          // Preventing the default is what stops Radix reaching for a trigger it does
          // not have; the drawer hands focus back itself instead.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          className={cn(
            'bg-surface-800 fixed inset-y-0 z-50 flex max-w-[85vw] flex-col shadow-xl',
            drawerWidth,
            side === 'left' ? 'left-0' : 'right-0',
            drawerMotion(side),
          )}
        >
          {/* The panel's own heading names the room, not the drawer, so the drawer
              carries a name of its own for anyone who cannot see which side it is on. */}
          <VisuallyHidden.Root asChild>
            <Dialog.Title>{label}</Dialog.Title>
          </VisuallyHidden.Root>

          {/* Sits on the uncovered strip rather than inside the panel, where it would
              land on top of whichever header the panel happens to start with. */}
          <Dialog.Close
            aria-label={closeLabel}
            className={cn(
              'bg-surface-800/90 text-content-300 hover:text-content-100 fixed top-3 grid size-9 place-items-center rounded-full shadow-lg transition-colors',
              side === 'left' ? 'right-3' : 'left-3',
            )}
          >
            <X className="size-4" aria-hidden />
          </Dialog.Close>

          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
