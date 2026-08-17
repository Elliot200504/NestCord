import { GENERIC_ERROR_MESSAGE } from '@nestcord/shared';

import { ApiError } from '@/api/client';

/**
 * Turns a failed mutation into one readable line.
 *
 * Every message that reaches here is already safe to show: the API's exception
 * filter replaces anything technical with a generic sentence before it leaves the
 * server. Anything that is not an ApiError never reached the server at all — a
 * dead network or a bug in the browser — and gets the same generic line, because
 * neither has a message worth reading.
 *
 * When the failure came with a reference, it is shown too. It is the only thing
 * that turns "it broke" into a report an admin can look up in the error log.
 */
export function FormError({ error }: { error: Error | null }) {
  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const message = isApiError ? error.message : GENERIC_ERROR_MESSAGE;
  const reference = isApiError ? error.reference : undefined;

  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
      {reference !== undefined && (
        <>
          {' '}
          <span className="text-muted-foreground">
            Reference <code className="font-mono">{reference}</code> — quote it if you report this.
          </span>
        </>
      )}
    </p>
  );
}
