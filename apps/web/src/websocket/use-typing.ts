import { useContext, useEffect, useRef } from 'react';

import { SocketEvent, TYPING_THROTTLE_MS } from '@nestcord/shared';

import { RealtimeContext } from './realtime-context';

/**
 * Tells the channel you are typing, at most once every few seconds.
 *
 * Throttled because the alternative is an event per keystroke, and the indicator it
 * drives lasts far longer than one keypress. `stop` is best-effort — the receiving
 * client expires the indicator on its own, so a missed stop costs nothing.
 */
export function useTyping(channelId: string) {
  const handle = useContext(RealtimeContext);
  const lastSentAt = useRef(0);

  // A channel switch must not carry the previous channel's throttle window with it,
  // or the first keystroke in the new channel would be swallowed.
  useEffect(() => {
    lastSentAt.current = 0;
  }, [channelId]);

  return {
    typing: () => {
      const now = Date.now();

      if (now - lastSentAt.current < TYPING_THROTTLE_MS) return;

      lastSentAt.current = now;
      handle?.current?.emit(SocketEvent.TYPING_START, { channelId });
    },

    stopTyping: () => {
      lastSentAt.current = 0;
      handle?.current?.emit(SocketEvent.TYPING_STOP, { channelId });
    },
  };
}
