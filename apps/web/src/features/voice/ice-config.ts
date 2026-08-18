/**
 * How a browser finds a route to its peers.
 *
 * STUN only, deliberately: it just tells each peer what its own public address looks
 * like, which is enough for most home connections. There is no TURN server, so two
 * peers behind unhelpful NATs may fail to connect at all — the tray shows that per
 * peer rather than sitting in silence. Adding TURN later is a change to this value,
 * not a redesign.
 */
const DEFAULT_STUN_URLS = 'stun:stun.l.google.com:19302';

function stunUrls(): string[] {
  const configured = import.meta.env.VITE_STUN_URLS ?? DEFAULT_STUN_URLS;

  return configured
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

export const iceConfig: RTCConfiguration = {
  iceServers: [{ urls: stunUrls() }],
};
