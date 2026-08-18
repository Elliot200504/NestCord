/**
 * The app's motion vocabulary (PLAN.MD §34, phase 10 — animations).
 *
 * Every transient surface — a dialog, a drawer, a menu — moves the same way, so the
 * app reads as one product rather than a set of separately dressed components. The
 * classes live here rather than in each component because five copies of a string
 * this long is five chances to drift.
 *
 * Two rules the numbers follow:
 *
 * - Opening is slower than closing. Arriving is information, so it gets 200ms to be
 *   read; leaving is already decided, so 150ms keeps the app feeling quick.
 * - Movement is small — a few pixels, a 5% scale. It should suggest where the surface
 *   came from, not perform.
 *
 * Reduced motion is honoured globally in `styles/index.css`: anyone who asks for less
 * movement lands on the end state immediately. Nothing here needs to repeat that.
 */

const BASE =
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-200 data-[state=closed]:duration-150 data-[state=open]:ease-out data-[state=closed]:ease-in';

/** The dimmed backdrop behind a modal. It only fades — a moving backdrop is noise. */
export const OVERLAY_MOTION = `${BASE} data-[state=open]:fade-in data-[state=closed]:fade-out`;

/** A centred dialog: it grows in from just below its resting place. */
export const DIALOG_MOTION = `${BASE} data-[state=open]:fade-in data-[state=closed]:fade-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2`;

/**
 * A dropdown or context menu. Radix stamps `data-side` on the content once it has
 * chosen where to place itself, so the menu always slides out of its trigger rather
 * than towards it — including when it flips to avoid a viewport edge.
 */
export const MENU_MOTION = `${BASE} data-[state=open]:fade-in data-[state=closed]:fade-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=top]:slide-in-from-bottom-1 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1`;

/** A side panel sliding in as a drawer on a narrow viewport. */
export function drawerMotion(side: 'left' | 'right'): string {
  return side === 'left'
    ? `${BASE} data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left`
    : `${BASE} data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right`;
}
