import { useEffect, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface ShellPanelProps {
  /** Which edge the panel is anchored to when it slides in as a drawer. */
  side: 'left' | 'right';
  /** False once the viewport is too narrow for the panel to have its own column. */
  wide: boolean;
  visible: boolean;
  onClose: () => void;
  /** Names the backdrop button, e.g. "Close the channel list". */
  closeLabel: string;
  children: ReactNode;
}

/**
 * A side panel of the app shell: a fixed column on a wide viewport, a dismissable
 * overlay on a narrow one (PLAN.MD §14, "make the UI responsive").
 *
 * Both side panels behave identically here, so the column/drawer decision lives in
 * one place rather than being re-derived — and wrongly — in each of them.
 */
export function ShellPanel({
  side,
  wide,
  visible,
  onClose,
  closeLabel,
  children,
}: ShellPanelProps) {
  // Escape closes the drawer, which is the gesture a reader expects from anything
  // overlaying the page. Only bound while it is actually overlaying something.
  const listening = visible && !wide;

  useEffect(() => {
    if (!listening) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [listening, onClose]);

  if (!visible) return null;

  if (wide) {
    return <div className="bg-surface-800 flex w-60 shrink-0 flex-col">{children}</div>;
  }

  return (
    <>
      {/* A button rather than a bare div so dismissing works by keyboard too. */}
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="bg-surface-900/70 animate-in fade-in fixed inset-0 z-40"
      />

      <div
        className={cn(
          'bg-surface-800 animate-in fixed inset-y-0 z-50 flex w-60 max-w-[85vw] flex-col shadow-xl',
          side === 'left' ? 'slide-in-from-left left-0' : 'slide-in-from-right right-0',
        )}
      >
        {children}
      </div>
    </>
  );
}
