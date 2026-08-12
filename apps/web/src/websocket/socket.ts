import { io, type Socket } from 'socket.io-client';

import { getAccessToken, refreshAccessToken } from '@/api/client';

/**
 * The one socket for the app.
 *
 * Same origin as the API — the dev server proxies the upgrade — so the handshake
 * behaves like every other request and needs no CORS exception. The token travels in
 * the handshake `auth` payload rather than a query string, because query strings end
 * up in proxy logs.
 */
export function connectRealtime(): Socket {
  const socket = io('/realtime', {
    auth: { token: getAccessToken() },
    // Websocket first; polling stays as the fallback for a proxy that will not upgrade.
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });

  attachTokenRefresh(socket);

  return socket;
}

/**
 * An access token lives minutes, a tab lives hours, so a reconnect will eventually
 * present an expired one. The server closes it; this trades the refresh cookie for a
 * new token and tries again, which is the same recovery the HTTP client does on a 401.
 */
function attachTokenRefresh(socket: Socket): void {
  let refreshing = false;

  socket.on('connect_error', async () => {
    if (refreshing) return;

    refreshing = true;

    try {
      const refreshed = await refreshAccessToken();

      if (!refreshed) return;

      socket.auth = { token: getAccessToken() };
      socket.connect();
    } finally {
      refreshing = false;
    }
  });
}
