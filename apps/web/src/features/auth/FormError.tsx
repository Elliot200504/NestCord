import { ApiError } from '@/api/client';

/**
 * Turns a failed mutation into one readable line. Anything that is not an
 * ApiError is a bug or a dead network — neither has a message worth showing.
 */
export function FormError({ error }: { error: Error | null }) {
  if (!error) return null;

  const message =
    error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}
