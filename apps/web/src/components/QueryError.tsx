interface QueryErrorProps {
  /**
   * What failed to arrive, as a noun phrase: "the member list", "your friends".
   * It fills both the message and the button's name, so the two cannot drift.
   */
  what: string;
  onRetry: () => void;
  /** Spacing the surrounding panel needs; the pair itself is styled here. */
  className?: string;
}

/**
 * A failed read, with the one thing that fixes it most of the time.
 *
 * Every async surface needs an error state (PLAN.MD §14), but an error state that
 * only apologises leaves a reader stuck reloading the whole page after one dropped
 * request. The button's name says what it will retry, because several of these can
 * be on screen at once and "Try again" three times over names nothing.
 */
export function QueryError({ what, onRetry, className }: QueryErrorProps) {
  return (
    <div className={className}>
      <p role="alert" className="text-destructive text-sm">
        Could not load {what}.
      </p>
      <button
        type="button"
        onClick={onRetry}
        aria-label={`Try loading ${what} again`}
        className="text-primary mt-2 text-sm hover:underline"
      >
        Try again
      </button>
    </div>
  );
}
