import { useEffect, useState } from 'react';

import type { PublicUser } from '@nestcord/shared';

import { typingIn, useTypingStore } from '@/stores/typing-store';

/** How often to re-check for indicators that have timed out. */
const TICK_MS = 1_000;

/**
 * "Ada is typing…" under the composer.
 *
 * It ticks on a timer because an indicator expires on its own — the server does not
 * promise a `typing:stop`, so nothing else would ever take the line down.
 */
export function TypingIndicator({ channelId, viewerId }: { channelId: string; viewerId: string }) {
  const byChannel = useTypingStore((state) => state.byChannel);
  const prune = useTypingStore((state) => state.prune);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      prune(Date.now());
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [prune]);

  const typing = typingIn(byChannel, channelId, viewerId, now);

  // The line takes no space when nobody is typing, rather than reserving a gap that
  // makes the composer jump.
  if (typing.length === 0) return null;

  return (
    <p
      aria-live="polite"
      className="text-content-400 animate-in fade-in h-4 px-5 pb-1 text-xs duration-200"
    >
      <span className="text-content-200">{describe(typing)}</span>
    </p>
  );
}

/** Names up to two people, then counts the rest. */
function describe(typing: PublicUser[]): string {
  const names = typing.map((user) => user.displayName ?? user.username);
  const [first, second] = names;

  if (names.length === 1) return `${first} is typing…`;
  if (names.length === 2) return `${first} and ${second} are typing…`;

  return `${first}, ${second} and ${names.length - 2} more are typing…`;
}
