/**
 * Minimal fetch wrapper. Requests go to /api, which Vite proxies to the NestJS
 * server in development, so the browser stays on a single origin.
 *
 * The access token lives in this module, in memory only. Putting it in
 * localStorage would leave it readable by any injected script; the refresh token
 * it is renewed from is an httpOnly cookie the browser handles for us.
 */

import { type ApiErrorBody, type AuthSession, GENERIC_ERROR_MESSAGE } from '@nestcord/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /**
     * The code the API sends with a failure it would not explain — the same code
     * an admin looks up in the error log. Absent from the errors that explain
     * themselves, which is most of them.
     */
    readonly reference?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

/** The socket handshake needs the token itself, not just whether there is one. */
export function getAccessToken(): string | null {
  return accessToken;
}

interface RequestOptions extends RequestInit {
  /**
   * Whether a 401 should trigger a refresh-and-retry. Off for the auth routes
   * themselves: a failed login is an answer, not an expired token.
   */
  retryOnUnauthorized?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { retryOnUnauthorized = true, ...init } = options;
  const response = await send(path, init);

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return parse<T>(await send(path, init));
  }

  return parse<T>(response);
}

async function send(path: string, init: RequestInit): Promise<Response> {
  // File uploads must let the browser set Content-Type itself — it has to append
  // the multipart boundary, which we could not know here.
  const isUpload = init.body instanceof FormData;

  return fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(isUpload ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // The API's exception filter guarantees `message` is safe to show a user. The
    // array form is still handled: a 404 for a URL no route matches is answered by
    // Express before the filter ever sees it.
    const body = (await response.json().catch(() => null)) as
      (Omit<ApiErrorBody, 'message'> & { message?: string | string[] }) | null;
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;

    throw new ApiError(response.status, message ?? GENERIC_ERROR_MESSAGE, body?.reference);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

let inFlightRefresh: Promise<boolean> | null = null;

/**
 * Trades the refresh cookie for a new access token. Concurrent callers share one
 * request so a page with several queries does not rotate the cookie five times.
 */
export function refreshAccessToken(): Promise<boolean> {
  inFlightRefresh ??= requestRefresh().finally(() => {
    inFlightRefresh = null;
  });

  return inFlightRefresh;
}

async function requestRefresh(): Promise<boolean> {
  try {
    const session = await apiRequest<AuthSession>('/auth/refresh', {
      method: 'POST',
      retryOnUnauthorized: false,
    });

    setAccessToken(session.accessToken);
    return true;
  } catch {
    // No usable session — the caller redirects to /login.
    setAccessToken(null);
    return false;
  }
}

export interface HealthResponse {
  status: string;
  database: string;
}

export const api = {
  health: () => apiRequest<HealthResponse>('/health'),
};
